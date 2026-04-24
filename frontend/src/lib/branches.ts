export type BranchLocation = {
  name: string;
  neighborhood: string;
  address: string;
  description: string;
  googleQuery: string;
  latitude: number;
  longitude: number;
  sourceLabel: string;
  sourceUrl: string;
};

export const BRANCH_LOCATIONS: BranchLocation[] = [
  {
    name: "Simba Kicukiro",
    neighborhood: "Kicukiro",
    address: "24G3+MCV, Kigali, Rwanda",
    description: "Kicukiro branch with independent inventory and pickup handling.",
    googleQuery: "Simba Supermarket Kicukiro, Kigali, Rwanda",
    latitude: -1.9707,
    longitude: 30.1109,
    sourceLabel: "Top-Rated.Online",
    sourceUrl: "https://www.top-rated.online/cities/Kicukiro/place/p/15345415/Simba%2BSupermarket%2BKicukiro",
  },
  {
    name: "Simba Kigali Heights",
    neighborhood: "Kigali Heights",
    address: "KG 541 St, Kigali, Rwanda",
    description: "Kigali Heights branch serving the city-center business district.",
    googleQuery: "Simba Supermarket Kigali Heights, KG 541 St, Kigali, Rwanda",
    latitude: -1.9498,
    longitude: 30.0921,
    sourceLabel: "Zaubee",
    sourceUrl: "https://zaubee.com/biz/simba-supermarket-kigali-heights-45mwelad",
  },
  {
    name: "Simba Gishushu",
    neighborhood: "Gishushu",
    address: "KN 5 Rd, Kigali, Rwanda",
    description: "Gishushu branch with its own stock pool and pickup orders.",
    googleQuery: "Simba Supermarket Gishushu, KN 5 Rd, Kigali, Rwanda",
    latitude: -1.9445,
    longitude: 30.1056,
    sourceLabel: "Wanderlog",
    sourceUrl: "https://wanderlog.com/place/details/11769528/simba-supermarket-gishushu",
  },
  {
    name: "Simba Gacuriro",
    neighborhood: "Gacuriro",
    address: "KG 14 Ave, Simba Center, Kigali, Rwanda",
    description: "Gacuriro branch inside Simba Center with separate stock from all other branches.",
    googleQuery: "Simba Center Gacuriro, KG 14 Ave, Kigali, Rwanda",
    latitude: -1.9171,
    longitude: 30.1198,
    sourceLabel: "Wanderlog",
    sourceUrl: "https://wanderlog.com/place/details/11444473/simba-center-gacuriro",
  },
  {
    name: "Simba Kimironko",
    neighborhood: "Kimironko",
    address: "Kimironko, Kigali, Rwanda",
    description: "Kimironko branch for independent pickup and stock tracking.",
    googleQuery: "Simba Kimironko, Kigali, Rwanda",
    latitude: -1.9492,
    longitude: 30.1254,
    sourceLabel: "Official Simba branch list",
    sourceUrl: "https://www.simbaonlineshopping.com/AboutUs.aspx",
  },
  {
    name: "Simba Kisimenti",
    neighborhood: "Kisimenti",
    address: "Kisimenti, Kigali, Rwanda",
    description: "Kisimenti branch inventory stays isolated from the rest of the network.",
    googleQuery: "Simba Kisimenti, Kigali, Rwanda",
    latitude: -1.9449,
    longitude: 30.0926,
    sourceLabel: "Official Simba branch list",
    sourceUrl: "https://www.simbaonlineshopping.com/AboutUs.aspx",
  },
  {
    name: "Simba Gikondo",
    neighborhood: "Gikondo",
    address: "Gikondo, Kigali, Rwanda",
    description: "Gikondo branch with branch-specific inventory counts.",
    googleQuery: "Simba Gikondo, Kigali, Rwanda",
    latitude: -1.9837,
    longitude: 30.0787,
    sourceLabel: "Official Simba branch list",
    sourceUrl: "https://www.simbaonlineshopping.com/AboutUs.aspx",
  },
  {
    name: "Simba Sonatube",
    neighborhood: "Sonatube",
    address: "Sonatube, Kigali, Rwanda",
    description: "Sonatube branch for local branch pickup and inventory.",
    googleQuery: "Simba Sonatube, Kigali, Rwanda",
    latitude: -1.9874,
    longitude: 30.1038,
    sourceLabel: "Official Simba branch list",
    sourceUrl: "https://www.simbaonlineshopping.com/AboutUs.aspx",
  },
  {
    name: "Simba UTC",
    neighborhood: "UTC / City Center",
    address: "Union Trade Center, Kigali, Rwanda",
    description: "City-center branch around UTC with separate branch stock.",
    googleQuery: "Simba UTC, Kigali, Rwanda",
    latitude: -1.9441,
    longitude: 30.0619,
    sourceLabel: "Official Simba branch list",
    sourceUrl: "https://www.simbaonlineshopping.com/AboutUs.aspx",
  },
  {
    name: "Simba Rebero",
    neighborhood: "Rebero",
    address: "Rebero, Kigali, Rwanda",
    description: "Rebero branch serving local pickup orders with isolated stock.",
    googleQuery: "Simba Rebero, Kigali, Rwanda",
    latitude: -1.9897,
    longitude: 30.0924,
    sourceLabel: "Official Simba branch list",
    sourceUrl: "https://www.simbaonlineshopping.com/AboutUs.aspx",
  },
  {
    name: "Simba Centenary",
    neighborhood: "Centenary",
    address: "Centenary area, Kigali, Rwanda",
    description: "Centenary branch inventory and orders stay independent from other branches.",
    googleQuery: "Simba Centenary, Kigali, Rwanda",
    latitude: -1.9526,
    longitude: 30.0612,
    sourceLabel: "Official Simba branch list",
    sourceUrl: "https://www.simbaonlineshopping.com/AboutUs.aspx",
  },
];

export const BRANCH_NAMES = BRANCH_LOCATIONS.map((branch) => branch.name);

export const getGoogleMapsLink = (query: string) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;

export const getGoogleMapsDirectionsLink = (
  destination: string,
  origin?: { latitude: number; longitude: number },
) => {
  const params = new URLSearchParams({
    api: "1",
    destination,
    travelmode: "driving",
  });

  if (origin) {
    params.set("origin", `${origin.latitude},${origin.longitude}`);
  }

  return `https://www.google.com/maps/dir/?${params.toString()}`;
};

export const getGoogleMapsDirectionsEmbedLink = (
  destination: string,
  origin?: { latitude: number; longitude: number },
) => {
  const params = new URLSearchParams({
    daddr: destination,
    output: "embed",
  });

  if (origin) {
    params.set("saddr", `${origin.latitude},${origin.longitude}`);
  }

  return `https://www.google.com/maps?${params.toString()}`;
};

export const getGoogleMapsEmbedLink = (query: string) =>
  `https://www.google.com/maps?q=${encodeURIComponent(query)}&output=embed`;
