import type { PictureKind } from "./picture-sources";

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
    pictures: PictureKind[];
    /** Subjects the Wellcome Collection pictures come from; picture-sources.ts has the default. */
    wellcome?: { subjects: string[] };
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

/** meteoblue's week forecast; it takes signed degrees (`42.05N-87.69E`) and sends hemisphere letters to The Hague. */
export const forecastUrl = `https://www.meteoblue.com/en/weather/week/${site.location.latitude}N${site.location.longitude}E`;
