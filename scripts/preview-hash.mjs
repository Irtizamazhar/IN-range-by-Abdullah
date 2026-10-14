import bcrypt from "bcryptjs";

async function readHidden(prompt) {
  if (!process.stdin.isTTY || !process.stdout.isTTY || typeof process.stdin.setRawMode !== "function") {
    throw new Error("Run this command in an interactive terminal so the password stays hidden.");
  }

  process.stdout.write(prompt);
  return new Promise((resolve, reject) => {
    let value = "";
    const finish = (error) => {
      process.stdin.off("data", onData);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write("\n");
      if (error) reject(error);
      else resolve(value);
    };
    const onData = (chunk) => {
      for (const character of chunk) {
        if (character === "\r" || character === "\n") return finish();
        if (character === "\u0003") return finish(new Error("Cancelled."));
        if (character === "\u007f" || character === "\b") value = value.slice(0, -1);
        else if (character >= " " && character !== "\u007f" && value.length < 200) value += character;
      }
    };
    process.stdin.setEncoding("utf8");
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on("data", onData);
  });
}

try {
  const password = await readHidden("Preview password (hidden): ");
  if (password.length < 12) throw new Error("Use a password with at least 12 characters.");
  const confirmation = await readHidden("Confirm password (hidden): ");
  if (password !== confirmation) throw new Error("Passwords do not match.");
  const hash = await bcrypt.hash(password, 12);
  process.stdout.write(`PREVIEW_PASSWORD_HASH=${hash}\n`);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : "Could not generate hash."}\n`);
  process.exitCode = 1;
}
