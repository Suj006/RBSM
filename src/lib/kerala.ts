/**
 * Kerala administrative masters used by the seller forms: taluks and block panchayats per district,
 * and the urban local bodies (municipalities and corporations). Grama panchayat names are typed in.
 */

export const TALUKS: Record<string, readonly string[]> = {
  Thiruvananthapuram: ["Chirayinkeezhu", "Kattakada", "Nedumangad", "Neyyattinkara", "Thiruvananthapuram", "Varkala"],
  Kollam: ["Karunagappally", "Kollam", "Kottarakkara", "Kunnathur", "Pathanapuram", "Punalur"],
  Pathanamthitta: ["Adoor", "Konni", "Kozhencherry", "Mallappally", "Ranni", "Thiruvalla"],
  Alappuzha: ["Ambalappuzha", "Chengannur", "Cherthala", "Karthikappally", "Kuttanad", "Mavelikkara"],
  Kottayam: ["Changanassery", "Kanjirappally", "Kottayam", "Meenachil", "Vaikom"],
  Idukki: ["Devikulam", "Idukki", "Peerumade", "Thodupuzha", "Udumbanchola"],
  Ernakulam: ["Aluva", "Kanayannur", "Kochi", "Kothamangalam", "Kunnathunad", "Muvattupuzha", "North Paravur"],
  Thrissur: ["Chalakudy", "Chavakkad", "Kodungallur", "Kunnamkulam", "Mukundapuram", "Thalappilly", "Thrissur"],
  Palakkad: ["Alathur", "Attappady", "Chittur", "Mannarkkad", "Ottapalam", "Palakkad", "Pattambi"],
  Malappuram: ["Ernad", "Kondotty", "Nilambur", "Perinthalmanna", "Ponnani", "Tirur", "Tirurangadi"],
  Kozhikode: ["Koyilandy", "Kozhikode", "Thamarassery", "Vadakara"],
  Wayanad: ["Mananthavady", "Sulthan Bathery", "Vythiri"],
  Kannur: ["Iritty", "Kannur", "Payyanur", "Taliparamba", "Thalassery"],
  Kasaragod: ["Hosdurg", "Kasaragod", "Manjeshwaram", "Vellarikundu"],
};

export const BLOCKS: Record<string, readonly string[]> = {
  Thiruvananthapuram: ["Athiyannoor", "Chirayinkeezhu", "Kilimanoor", "Nedumangad", "Nemom", "Parassala", "Perumkadavila", "Pothencode", "Vamanapuram", "Varkala", "Vellanad"],
  Kollam: ["Anchal", "Chadayamangalam", "Chavara", "Chittumala", "Ithikkara", "Kottarakkara", "Mukhathala", "Oachira", "Pathanapuram", "Sasthamcotta", "Vettikkavala"],
  Pathanamthitta: ["Elanthoor", "Koipuram", "Konni", "Mallappally", "Pandalam", "Parakode", "Pulikeezhu", "Ranni"],
  Alappuzha: ["Ambalappuzha", "Aryad", "Bharanikkavu", "Champakulam", "Chengannur", "Harippad", "Kanjikuzhy", "Mavelikkara", "Muthukulam", "Pattanakkad", "Thycattussery", "Veliyanad"],
  Kottayam: ["Erattupetta", "Ettumanoor", "Kaduthuruthy", "Kanjirappally", "Lalam", "Madappally", "Pallom", "Pampady", "Uzhavoor", "Vaikom", "Vazhoor"],
  Idukki: ["Adimaly", "Azhutha", "Devikulam", "Elemdesam", "Idukki", "Kattappana", "Nedumkandam", "Thodupuzha"],
  Ernakulam: ["Alangad", "Angamaly", "Edappally", "Kothamangalam", "Koovappady", "Mulanthuruthy", "Muvattupuzha", "Palluruthy", "Pampakuda", "Parakkadavu", "Paravur", "Vadavucode", "Vazhakulam", "Vypin"],
  Thrissur: ["Anthikad", "Chalakudy", "Chavakkad", "Cherpu", "Chowannur", "Irinjalakuda", "Kodakara", "Mala", "Mathilakam", "Mullassery", "Ollukkara", "Pazhayannur", "Puzhakkal", "Thalikulam", "Vellangallur", "Wadakkanchery"],
  Palakkad: ["Alathur", "Attappady", "Chittur", "Kollengode", "Kuzhalmannam", "Malampuzha", "Mannarkkad", "Nenmara", "Ottapalam", "Palakkad", "Pattambi", "Sreekrishnapuram", "Thrithala"],
  Malappuram: ["Areekode", "Kalikavu", "Kondotty", "Kuttippuram", "Malappuram", "Mankada", "Nilambur", "Perinthalmanna", "Perumpadappu", "Ponnani", "Tanur", "Tirur", "Tirurangadi", "Vengara", "Wandoor"],
  Kozhikode: ["Balussery", "Chelannur", "Koduvally", "Kozhikode", "Kunnamangalam", "Kunnummal", "Melady", "Panthalayani", "Perambra", "Thodannur", "Thuneri", "Vadakara"],
  Wayanad: ["Kalpetta", "Mananthavady", "Panamaram", "Sulthan Bathery"],
  Kannur: ["Edakkad", "Iritty", "Irikkur", "Kalliasseri", "Kannur", "Kuthuparamba", "Panoor", "Payyanur", "Peravoor", "Taliparamba", "Thalassery"],
  Kasaragod: ["Kanhangad", "Karadka", "Kasaragod", "Manjeshwar", "Nileshwar", "Parappa"],
};

export const MUNICIPALITIES: Record<string, readonly string[]> = {
  Thiruvananthapuram: ["Attingal", "Nedumangad", "Neyyattinkara", "Varkala"],
  Kollam: ["Karunagappally", "Kottarakkara", "Paravur", "Punalur"],
  Pathanamthitta: ["Adoor", "Pandalam", "Pathanamthitta", "Thiruvalla"],
  Alappuzha: ["Alappuzha", "Chengannur", "Cherthala", "Haripad", "Kayamkulam", "Mavelikkara"],
  Kottayam: ["Changanassery", "Erattupetta", "Ettumanoor", "Kottayam", "Pala", "Vaikom"],
  Idukki: ["Kattappana", "Thodupuzha"],
  Ernakulam: ["Aluva", "Angamaly", "Eloor", "Kalamassery", "Koothattukulam", "Kothamangalam", "Maradu", "Muvattupuzha", "North Paravur", "Perumbavoor", "Piravom", "Thrikkakara", "Thrippunithura"],
  Thrissur: ["Chalakudy", "Chavakkad", "Guruvayur", "Irinjalakuda", "Kodungallur", "Kunnamkulam", "Wadakkanchery"],
  Palakkad: ["Cherpulassery", "Chittur-Thathamangalam", "Mannarkkad", "Ottapalam", "Palakkad", "Pattambi", "Shoranur"],
  Malappuram: ["Kondotty", "Kottakkal", "Malappuram", "Manjeri", "Nilambur", "Parappanangadi", "Perinthalmanna", "Ponnani", "Tanur", "Tirur", "Tirurangadi", "Valanchery"],
  Kozhikode: ["Feroke", "Koduvally", "Koyilandy", "Mukkam", "Payyoli", "Ramanattukara", "Vadakara"],
  Wayanad: ["Kalpetta", "Mananthavady", "Sulthan Bathery"],
  Kannur: ["Anthoor", "Iritty", "Kuthuparamba", "Mattannur", "Panoor", "Payyanur", "Sreekandapuram", "Taliparamba", "Thalassery"],
  Kasaragod: ["Kanhangad", "Kasaragod", "Nileshwaram"],
};

export const CORPORATIONS: Record<string, readonly string[]> = {
  Thiruvananthapuram: ["Thiruvananthapuram"], Kollam: ["Kollam"], Ernakulam: ["Kochi"], Thrissur: ["Thrissur"],
  Kozhikode: ["Kozhikode"], Kannur: ["Kannur"],
};

/** Urban local bodies of a type in a district (empty for panchayats, whose names are typed in). */
export function urbanBodies(district: string, type: string): readonly string[] {
  if (type === "MUNICIPALITY") return MUNICIPALITIES[district] ?? [];
  if (type === "CORPORATION") return CORPORATIONS[district] ?? [];
  return [];
}

/** The canonical spelling of `value` in `list` (case- and space-insensitive), or null. */
export function canonical(list: readonly string[] | undefined, value: string): string | null {
  const k = value.trim().toLowerCase().replace(/\s+/g, " ");
  return list?.find((x) => x.toLowerCase() === k) ?? null;
}
