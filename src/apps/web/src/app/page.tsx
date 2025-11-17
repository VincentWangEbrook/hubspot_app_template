"use client";

import Link from 'next/link';
import { useState, useEffect } from 'react';
import styles from './page.module.css';

export default function Home() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const slides = [
    {
      title: 'Boost Your Productivity',
      description: 'Discover how our tools can help you automate workflows and save time.',
    },
    {
      title: 'Advanced Analytics',
      description: 'Get real-time insights into your HubSpot data.',
    },
    {
      title: 'Seamless Integrations',
      description: 'Connect HubSpot with your favorite apps effortlessly.',
    },
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev === slides.length - 1 ? 0 : prev + 1));
    }, 3000);
    return () => clearInterval(interval);
  }, [slides.length]);

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1>eTrunk</h1>
        <p>Seamlessly manage your HubSpot integrations</p>
      </header>

      {/* Slider Section */}
      <section className={styles.slider}>
        <div className={styles.slide}>
          <h2>{slides[currentSlide].title}</h2>
          <p>{slides[currentSlide].description}</p>
        </div>
        <div className={styles.sliderDots}>
          {slides.map((_, index) => (
            <button
              key={index}
              className={`${styles.dot} ${index === currentSlide ? styles.activeDot : ''}`}
              onClick={() => setCurrentSlide(index)}
            />
          ))}
        </div>
      </section>

      {/* Banner Section */}
      <section className={styles.banner}>
        <h2>Limited Time Offer</h2>
        <p>Sign up now and get 30% off on your first subscription!</p>
        <Link href="/subscription" className={styles.ctaButton}>Get Started</Link>
      </section>

      <main className={styles.main}>
        <section className={styles.hero}>
          <h2>Welcome to eTrunk</h2>
          <p>Streamline your HubSpot workflows with our powerful tools and integrations.</p>
        </section>
        <section className={styles.features}>
          <div className={styles.feature}>
            <h3>Analytics</h3>
            <p>Track and analyze your HubSpot data with real-time dashboards.</p>
          </div>
          <div className={styles.feature}>
            <h3>Automation</h3>
            <p>Automate repetitive tasks and save time.</p>
          </div>
          <div className={styles.feature}>
            <h3>Integrations</h3>
            <p>Connect HubSpot with your favorite tools and services.</p>
          </div>
        </section>
      </main>

      {/* Additional Content Blocks */}
      <section className={styles.contentBlock}>
        <h2>Why Choose Us?</h2>
        <div className={styles.reasons}>
          <div className={styles.reason}>
            <h3>24/7 Support</h3>
            <p>Our team is always ready to assist you.</p>
          </div>
          <div className={styles.reason}>
            <h3>Easy Setup</h3>
            <p>Get started in minutes with our intuitive interface.</p>
          </div>
          <div className={styles.reason}>
            <h3>Scalable Solutions</h3>
            <p>Grow your business with our flexible tools.</p>
          </div>
        </div>
      </section>

      <footer className={styles.footer}>
        <p>&copy; 2025 eTrunk. All rights reserved.</p>
        <p>Contact: support@eTrunk.com.tw</p>
      </footer>
    </div>
  );
}