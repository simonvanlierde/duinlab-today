export interface SiteConfig {
  site: { title: string; url: string; description: string };
  location: {
    name: string;
    latitude: number;
    longitude: number;
    timezone: string;
    country: string;
  };
  units: { temperature: "celsius" | "fahrenheit"; wind: "kmh" | "mph" };
  content: {
    pictures: ("apod" | "met" | "wikipedia" | "aic" | "rijks")[];
    tides: boolean;
    sea: boolean;
    events: boolean;
    radar: "knmi" | "buienradar" | "none";
    holidays: "nl" | "none";
  };
  games: { id: string; name: string; url: string; blurb: string }[];
}

declare const __SITE_CONFIG__: SiteConfig;
declare const __SITE_CONFIG_KEY__: string;

export const site: SiteConfig = __SITE_CONFIG__;
export const configKey: string = __SITE_CONFIG_KEY__;

// Keep the already-published quiz only when upgrading the original deployment's sources.
export const usesLegacyDay =
  site.location.latitude === 52.08 &&
  site.location.longitude === 4.31 &&
  site.location.timezone === "Europe/Amsterdam" &&
  site.location.country === "NL" &&
  site.content.tides &&
  site.content.sea &&
  site.content.events &&
  site.content.radar === "knmi" &&
  site.content.holidays === "nl" &&
  site.content.pictures.join(",") === "apod,met,wikipedia,aic,rijks";
