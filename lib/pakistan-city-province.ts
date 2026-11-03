export const PAKISTAN_PROVINCES = [
  "Punjab",
  "Sindh",
  "Khyber Pakhtunkhwa",
  "Balochistan",
  "Islamabad Capital Territory",
  "Azad Jammu and Kashmir",
  "Gilgit-Baltistan",
] as const;

const BY_PROVINCE: Record<(typeof PAKISTAN_PROVINCES)[number], string[]> = {
  Punjab: ["Lahore", "Faisalabad", "Rawalpindi", "Multan", "Gujranwala", "Sialkot", "Bahawalpur", "Sargodha", "Sheikhupura", "Jhang", "Rahim Yar Khan", "Gujrat", "Kasur", "Sahiwal", "Okara", "Wah Cantonment", "Dera Ghazi Khan", "Mandi Bahauddin", "Chiniot", "Kamoke", "Hafizabad", "Sadiqabad", "Burewala", "Khanewal", "Muzaffargarh", "Jhelum", "Khanpur", "Attock", "Chakwal", "Vehari", "Mianwali", "Bhakkar", "Narowal", "Pakpattan", "Toba Tek Singh", "Lodhran", "Layyah", "Rajanpur", "Khushab", "Nankana Sahib", "Murree", "Taxila", "Bahawalnagar", "Daska", "Gojra", "Wazirabad"],
  Sindh: ["Karachi", "Hyderabad", "Sukkur", "Larkana", "Nawabshah", "Mirpur Khas", "Jacobabad", "Shikarpur", "Khairpur", "Dadu", "Thatta", "Badin", "Sanghar", "Tando Adam", "Tando Allahyar", "Umerkot", "Ghotki", "Kotri", "Jamshoro", "Kashmore"],
  "Khyber Pakhtunkhwa": ["Peshawar", "Mardan", "Abbottabad", "Mingora", "Swat", "Kohat", "Dera Ismail Khan", "Mansehra", "Nowshera", "Charsadda", "Swabi", "Bannu", "Haripur", "Chitral", "Karak", "Lakki Marwat", "Timergara", "Batkhela", "Hangu", "Tank"],
  Balochistan: ["Quetta", "Turbat", "Khuzdar", "Hub", "Chaman", "Gwadar", "Sibi", "Zhob", "Loralai", "Dera Murad Jamali", "Kalat", "Mastung", "Nushki", "Pishin", "Usta Muhammad"],
  "Islamabad Capital Territory": ["Islamabad"],
  "Azad Jammu and Kashmir": ["Muzaffarabad", "Mirpur", "Kotli", "Bhimber", "Rawalakot", "Bagh", "Pallandri"],
  "Gilgit-Baltistan": ["Gilgit", "Skardu", "Hunza", "Chilas", "Ghanche", "Ghizer"],
};

const LOOKUP = new Map(Object.entries(BY_PROVINCE).flatMap(([province, cities]) => cities.map(city => [city.toLowerCase(), province])));

/** Province for a well-known city, or "" when the city is not in the curated list. */
export function provinceForCity(city: string): string {
  return LOOKUP.get(city.trim().toLowerCase()) || "";
}
