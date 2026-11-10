/**
 * Cities where JORO delivers with Cash on Delivery. These are always COD-enabled and form the
 * checkout city list. Admin Settings → COD cities can add more, but cannot remove these.
 */
export const COD_CITIES: readonly string[] = [
  "Abbottabad", "Abdul Khel", "Adilpur", "Ahmadpur East", "Ahmadpur Sial", "Akora Khattak", "Attock",
  "Bagh", "Bahawalpur", "Badin", "Bannu", "Bhakkar", "Bhimber",
  "Chakwal", "Chaman", "Charsadda", "Chilas", "Chiniot", "Chitral",
  "Dadu", "Dera Ghazi Khan", "Dera Ismail Khan", "Dera Murad Jamali",
  "Faisalabad",
  "Gahkuch", "Ghotki", "Gilgit", "Gujranwala", "Gujrat", "Gwadar",
  "Hafizabad", "Haripur", "Hyderabad",
  "Islamabad",
  "Jacobabad", "Jhang", "Jhelum",
  "Kamoke", "Karachi", "Kasur", "Khairpur", "Khanewal", "Khushab", "Kohat", "Kotli", "Khuzdar",
  "Lahore", "Lakki Marwat", "Layyah", "Larkana", "Lodhran", "Loralai",
  "Mandi Bahauddin", "Mansehra", "Mardan", "Mingora", "Mianwali", "Mirpur", "Mirpur Khas",
  "Muzaffarabad", "Muzaffargarh", "Muridke", "Multan",
  "Nankana Sahib", "Narowal", "Nawabshah", "Nowshera",
  "Okara",
  "Pakpattan", "Palandri", "Peshawar",
  "Quetta",
  "Rahim Yar Khan", "Rawalakot", "Rawalpindi",
  "Sadiqabad", "Sahiwal", "Sanghar", "Sargodha", "Sheikhupura", "Shikarpur", "Sialkot", "Sibi",
  "Skardu", "Sukkur", "Swabi", "Swat",
  "Taxila", "Thatta", "Timergara", "Toba Tek Singh", "Turbat", "Tando Adam", "Tando Allahyar",
  "Vehari",
];

const key = (city: string) => city.trim().toLocaleLowerCase();

/** Built-in COD cities plus any extra cities the admin enabled, sorted, without duplicates. */
export function codCityOptions(adminCities: readonly string[] = []): string[] {
  const byKey = new Map<string, string>();
  for (const city of [...COD_CITIES, ...adminCities]) {
    const name = city.trim();
    if (name && !byKey.has(key(name))) byKey.set(key(name), name);
  }
  return Array.from(byKey.values()).sort((a, b) => a.localeCompare(b));
}

export function isCodCity(city: string, adminCities: readonly string[] = []): boolean {
  const wanted = key(city);
  return Boolean(wanted) && codCityOptions(adminCities).some((name) => key(name) === wanted);
}
