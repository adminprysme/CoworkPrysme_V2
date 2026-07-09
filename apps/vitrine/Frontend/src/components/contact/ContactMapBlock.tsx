"use client";

import { ContactBuildingMap } from "./ContactBuildingMap";
import styles from "./ContactPageContent.module.css";

interface ContactMapBlockProps {
  lat: number;
  lng: number;
  name: string;
}

export function ContactMapBlock({ lat, lng, name }: ContactMapBlockProps) {
  return (
    <div className={styles.mapFrame}>
      <ContactBuildingMap lat={lat} lng={lng} name={name} />
    </div>
  );
}
