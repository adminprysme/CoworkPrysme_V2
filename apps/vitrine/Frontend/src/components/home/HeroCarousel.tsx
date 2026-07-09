"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

import styles from "./HeroSection.module.css";

interface HeroCarouselProps {
  images: string[];
}

export function HeroCarousel({ images }: HeroCarouselProps) {
  const [index, setIndex] = useState(0);
  const slides = images.length > 0 ? images : [];

  useEffect(() => {
    if (slides.length <= 1) {
      return;
    }

    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % slides.length);
    }, 6000);

    return () => window.clearInterval(timer);
  }, [slides.length]);

  if (slides.length === 0) {
    return null;
  }

  return (
    <>
      {slides.map((src, slideIndex) => (
        <Image
          key={src}
          src={src}
          alt=""
          fill
          priority={slideIndex === 0}
          sizes="100vw"
          className={[styles.media, slideIndex === index ? styles.mediaActive : styles.mediaHidden]
            .filter(Boolean)
            .join(" ")}
        />
      ))}
    </>
  );
}
