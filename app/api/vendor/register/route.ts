export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { VendorBusinessType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sanitizePlainText } from "@/lib/security/sanitize";
import { consumeOrReject, createRegisterRateLimiter } from "@/lib/security/rate-limit";
import { vendorRegisterFormFieldsSchema } from "@/lib/vendor-auth-schemas";
import { sendVendorVerificationEmail } from "@/lib/vendor-mail";
import { clientIp } from "@/lib/vendor-ip";
import { saveVendorDocumentBuffer } from "@/lib/vendor-doc-upload";
import { vendorEmailVerificationRequired } from "@/lib/vendor-email-verification-flag";

const registerLimiter = createRegisterRateLimiter();

function fileOrNull(fd: FormData, key: string): File | null {
  const v = fd.get(key);
  return v instanceof File && v.size > 0 ? v : null;
}

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  const limited = await consumeOrReject(registerLimiter, `vendor-reg:${ip}`);
  if (!limited.ok) {
    return NextResponse.json(
      {
        error: "Too many registration attempts. Try again later.",
        retrySecs: limited.retrySecs,
      },
      { status: 429 }
    );
  }

  const ct = req.headers.get("content-type") || "";
  if (!ct.includes("multipart/form-data")) {
    return NextResponse.json(
      { error: "Use multipart/form-data with fields and image files." },
      { status: 400 }
    );
  }

  let fd: FormData;
  try {
    fd = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const businessTypeRaw =
    String(fd.get("businessType") || "").toLowerCase() === "company"
      ? "company"
      : "individual";
  const br = fd.get("businessRegNo");
  const rawFields = {
    name: String(fd.get("name") ?? ""),
    email: String(fd.get("email") ?? ""),
    password: String(fd.get("password") ?? ""),
    phone: String(fd.get("phone") ?? ""),
    city: String(fd.get("city") ?? ""),
    address: String(fd.get("address") ?? ""),
    shopName: String(fd.get("shopName") ?? ""),
    businessType: businessTypeRaw,
    businessRegNo:
      br == null || String(br).trim() === "" ? null : String(br),
    cnic: String(fd.get("cnic") ?? ""),
    category: String(fd.get("category") ?? ""),
    bankName: String(fd.get("bankName") ?? ""),
    accountTitle: String(fd.get("accountTitle") ?? ""),
    accountNumber: String(fd.get("accountNumber") ?? ""),
  };

  const parsed = vendorRegisterFormFieldsSchema.safeParse(rawFields);
  if (!parsed.success) {
    const msg = parsed.error.flatten().fieldErrors;
    const first = Object.values(msg).flat()[0] || "Validation failed";
    return NextResponse.json({ error: first, details: msg }, { status: 400 });
  }

  const raw = parsed.data;
  if (
    raw.businessType === "company" &&
    (!raw.businessRegNo || raw.businessRegNo.trim().length < 2)
  ) {
    return NextResponse.json(
      { error: "Business registration number is required for companies" },
      { status: 400 }
    );
  }

  const cnicFront = fileOrNull(fd, "cnic_front");
  const cnicBack = fileOrNull(fd, "cnic_back");
  const license = fileOrNull(fd, "license");

  if (!cnicFront || !cnicBack) {
    return NextResponse.json(
      { error: "CNIC front and CNIC back images are required" },
      { status: 400 }
    );
  }
  if (raw.businessType === "company" && !license) {
    return NextResponse.json(
      { error: "Business license image is required for companies" },
      { status: 400 }
    );
  }

  const email = sanitizePlainText(raw.email, 255).toLowerCase();
  const name = sanitizePlainText(raw.name, 200);
  const phone = sanitizePlainText(raw.phone, 20);
  const city = sanitizePlainText(raw.city, 120);
  const address = sanitizePlainText(raw.address, 2000);
  const shopName = sanitizePlainText(raw.shopName, 200);
  const cnic = sanitizePlainText(raw.cnic, 20);
  const category = sanitizePlainText(raw.category, 100);
  const bankName = sanitizePlainText(raw.bankName, 120);
  const accountTitle = sanitizePlainText(raw.accountTitle, 200);
  const accountNumber = sanitizePlainText(raw.accountNumber, 40);
  const businessRegNo =
    raw.businessRegNo != null && raw.businessRegNo !== ""
      ? sanitizePlainText(raw.businessRegNo, 120)
      : null;

  const [byEmail, byCnic] = await Promise.all([
    prisma.vendor.findUnique({ where: { email } }),
    prisma.vendor.findUnique({ where: { cnic } }),
  ]);
  if (byEmail) {
    return NextResponse.json(
      { error: "A vendor account with this email already exists" },
      { status: 409 }
    );
  }
  if (byCnic) {
    return NextResponse.json(
      { error: "This CNIC is already registered" },
      { status: 409 }
    );
  }

  const passwordHash = await bcrypt.hash(raw.password, 12);
  const requireEmailVerification = vendorEmailVerificationRequired();
  const emailVerifyToken = requireEmailVerification
    ? randomBytes(32).toString("hex")
    : null;
  const businessTypeEnum =
    raw.businessType === "company"
      ? VendorBusinessType.company
      : VendorBusinessType.individual;

  let vendorId: string;
  try {
    const vendor = await prisma.vendor.create({
      data: {
        ownerName: name,
        email,
        passwordHash,
        phone,
        city,
        address,
        shopName,
        cnic,
        businessType: businessTypeEnum,
        businessRegNo,
        bankName,
        accountTitle,
        accountNumber,
        primaryCategory: category,
        emailVerifyToken,
        isEmailVerified: !requireEmailVerification,
        status: "pending",
      },
    });
    vendorId = vendor.id;

    try {
      const frontBuf = Buffer.from(await cnicFront.arrayBuffer());
      await saveVendorDocumentBuffer(
        vendorId,
        "cnic_front",
        frontBuf,
        cnicFront.type || "image/jpeg"
      );
      const backBuf = Buffer.from(await cnicBack.arrayBuffer());
      await saveVendorDocumentBuffer(
        vendorId,
        "cnic_back",
        backBuf,
        cnicBack.type || "image/jpeg"
      );
      if (license) {
        const licBuf = Buffer.from(await license.arrayBuffer());
        await saveVendorDocumentBuffer(
          vendorId,
          "license",
          licBuf,
          license.type || "image/jpeg"
        );
      }
    } catch (docErr) {
      console.error("vendor register documents", docErr);
      await prisma.vendor.delete({ where: { id: vendorId } }).catch(() => {});
      return NextResponse.json(
        { error: "Could not save document images. Use JPG, PNG, or WebP under 5MB each." },
        { status: 400 }
      );
    }
  } catch (e) {
    console.error("vendor register", e);
    return NextResponse.json(
      { error: "Registration failed. Please try again." },
      { status: 500 }
    );
  }

  if (requireEmailVerification && emailVerifyToken) {
    try {
      await sendVendorVerificationEmail(email, emailVerifyToken);
    } catch (e) {
      console.error("vendor verification email", e);
    }
  }

  const message = requireEmailVerification
    ? "Registration received. Check your email to verify your address. We will review your application after verification."
    : "Registration received. After an admin approves your application, sign in with your email and password to open the dashboard.";

  return NextResponse.json({
    ok: true,
    message,
    requireEmailVerification,
  });
}
