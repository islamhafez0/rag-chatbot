import fs from "fs";
import path from "path";
import yaml from "js-yaml";

export interface Photo {
  src: string;
  alt: string;
}

/**
 * Parses the photos YAML file and returns a list of photo objects.
 * This is designed to be used at build-time or in server components.
 */
export function getPhotos(): Photo[] {
  try {
    const filePath = path.join(process.cwd(), "career_brain/facts/photos.yml");
    const fileContents = fs.readFileSync(filePath, "utf8");
    const data = yaml.load(fileContents) as { gallery: string[] };

    if (!data || !data.gallery) return [];

    return data.gallery.map((entry) => {
      const [src, ...descriptionParts] = entry.split(":");
      return {
        src: src.trim(),
        alt: descriptionParts.join(":").trim(),
      };
    });
  } catch (error) {
    console.error("Error parsing photos.yml:", error);
    return [];
  }
}
