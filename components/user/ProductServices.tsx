"use client";

import { useEffect, useState } from "react";
import { useCart, type CartLine } from "@/context/CartContext";
import { useCustomerAuth } from "@/context/CustomerAuthContext";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { PageSkeleton } from "@/components/ui/PageSkeleton";

type Service = {
  id: string;
  name: string;
  description: string;
  price: string;
  cities: string[];
  durationMinutes: number;
  leadDays: number;
  warranty: string;
  cancellationTerms: string;
};

export function ProductServices({ line }: { line: CartLine }) {
  const { addItem } = useCart();
  const { requireCustomer } = useCustomerAuth();
  const [loading, setLoading] = useState(true);
  const [services, setServices] = useState<Service[]>([]);
  const [city, setCity] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setMessage("");
    setServices([]);
    setCity("");
    fetch(`/api/products/${encodeURIComponent(line.productId)}/services`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Service availability could not be loaded.");
        const data = await response.json();
        if (!controller.signal.aborted) setServices(Array.isArray(data.services) ? data.services : []);
      })
      .catch(() => { if (!controller.signal.aborted) setError("Service availability could not be loaded. Please try again later."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [line.productId]);

  if (!loading && !error && services.length === 0) return null;

  const cities = Array.from(new Set(services.flatMap((service) => service.cities))).sort((a, b) => a.localeCompare(b));

  return (
    <section aria-labelledby="product-services-title" className="mt-6 rounded-2xl border border-[#DFEDE5] bg-white p-4 shadow-sm sm:p-6">
      <h2 id="product-services-title" className="text-xl font-bold text-[#123D27]">Add Services to Your Purchase</h2>
      <p className="mt-1 text-sm text-[#506257]">Optional services from this product&apos;s seller. Choose a coverage city to check availability.</p>
      {loading && <div className="mt-4"><PageSkeleton label="Loading services…" rows={2} /></div>}
      {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
      {services.length > 0 && (
        <>
          <label htmlFor="product-service-city" className="mt-5 block text-sm font-semibold text-[#123D27]">Coverage city</label>
          <select id="product-service-city" value={city} onChange={(event) => { setCity(event.target.value); setMessage(""); }} className="mt-2 w-full max-w-sm rounded-xl border border-[#C7DCD0] bg-white px-3 py-3 text-[#123D27] outline-none focus-visible:ring-2 focus-visible:ring-[#005235]">
            <option value="">Select a city</option>
            {cities.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
          <p className="mt-2 text-xs text-[#506257]">Use the same city for your delivery address at checkout.</p>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {services.map((service) => {
              const eligible = service.cities.some((covered) => covered.toLowerCase() === city.toLowerCase());
              return (
                <article key={service.id} className="rounded-2xl border border-[#DFEDE5] bg-[#F7FAF7] p-4">
                  <h3 className="text-base font-bold text-[#123D27]">{service.name}</h3>
                  <p className="mt-1 text-lg font-extrabold text-[#005235]">PKR {Number(service.price).toLocaleString("en-PK")} <span className="text-xs font-medium text-[#506257]">per unit</span></p>
                  <p className="mt-3 whitespace-pre-wrap text-sm text-[#334B3D]">{service.description}</p>
                  <dl className="mt-4 grid gap-2 text-sm text-[#334B3D]">
                    <div><dt className="inline font-semibold">Coverage: </dt><dd className="inline">{service.cities.join(", ")}</dd></div>
                    {service.durationMinutes > 0 && <div><dt className="inline font-semibold">Duration: </dt><dd className="inline">{service.durationMinutes} minutes</dd></div>}
                    {service.leadDays > 0 && <div><dt className="inline font-semibold">Lead time: </dt><dd className="inline">{service.leadDays} days</dd></div>}
                    {service.warranty && <div><dt className="inline font-semibold">Warranty: </dt><dd className="inline">{service.warranty}</dd></div>}
                    {service.cancellationTerms && <div><dt className="inline font-semibold">Cancellation: </dt><dd className="inline">{service.cancellationTerms}</dd></div>}
                  </dl>
                  {city && !eligible && <p className="mt-3 text-sm text-amber-800">Unavailable in {city}.</p>}
                  <LoadingButton
                    type="button"
                    disabled={!eligible || line.quantity < 1 || line.maxStock < line.quantity}
                    onClick={() => requireCustomer(() => {
                      addItem({ ...line, serviceId: service.id, serviceName: service.name, servicePrice: Number(service.price) });
                      setMessage(`${service.name} and the product were added to your cart.`);
                    }, "login")}
                    className="mt-4 rounded-xl bg-[#B7E33A] px-4 py-3 text-sm font-bold text-[#123D27] transition hover:bg-[#a9d62e] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#005235] disabled:cursor-not-allowed disabled:opacity-50"
                  >Add product with service</LoadingButton>
                </article>
              );
            })}
          </div>
        </>
      )}
      {message && <p role="status" className="mt-4 text-sm font-medium text-[#005235]">{message}</p>}
    </section>
  );
}
