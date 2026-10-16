import type { Metadata } from "next";
import Image from "next/image";
import Link from "@/components/ui/LoadingLink";
import { ArrowRight, Bookmark, Compass, Link2, MessageSquarePlus, Search, Store, Wrench } from "lucide-react";
import { PostWantButton } from "@/components/user/PostWantButton";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "About JORO | People, Products & Possibilities",
  description: "Meet JORO, a Pakistan-focused marketplace connecting everyday needs with products, services and seller opportunities. Founded by Hamid Khan and Irtiza.",
};

const features = [
  { Icon: Search, title: "Discover Products", text: "Explore marketplace listings and find products to consider for your everyday needs.", href: "/products", action: "Explore products" },
  { Icon: MessageSquarePlus, title: "Request a Want", text: "Tell sellers what you need. Product, service and gift requests give your search a starting point.", href: "/wants", action: "Explore Wants" },
  { Icon: Link2, title: "Connect with Sellers", text: "Discover storefronts and relevant offers through the existing Wants and seller workflows.", href: "/stores", action: "Meet sellers" },
  { Icon: Wrench, title: "Explore Services", text: "Browse listed services and describe the work you need through a service request.", href: "/services", action: "Explore services" },
  { Icon: Store, title: "Grow Your Business", text: "Apply as a seller to present your products and participate in the marketplace, subject to approval.", href: "/sell", action: "Become a Seller" },
  { Icon: Bookmark, title: "Save Your Favorites", text: "Use product hearts to keep items in your account’s Saved Items and revisit them later.", href: "/account/saved", action: "Open Saved Items" },
];
const connections = [["People", "Products"], ["Customers", "Sellers"], ["Needs", "Solutions"], ["Businesses", "Opportunities"]];
const values = ["Simplicity", "Accessibility", "Practical solutions", "Business opportunities", "Customer convenience"];
const direction = ["Pakistan-focused commerce", "Customer and seller connections", "Product and service discovery", "Request-driven commerce", "Local business participation", "Future marketplace expansion"];

export default function AboutPage() {
  return <article className={styles.page}>
    <header className={styles.hero}>
      <div>
        <h1 className={styles.eyebrow}>About JORO</h1>
        <p className={styles.heroMessage}>Connecting People,<br />Products &amp; Possibilities.</p>
        <p className={styles.intro}>JORO is a Pakistan-focused digital marketplace built around a simple idea: making it easier for people to find what they need and for businesses to reach the people who need them.</p>
        <div className={styles.actions}><Link href="/products" className={styles.primary}>Explore JORO <ArrowRight aria-hidden="true" /></Link><PostWantButton className={styles.secondary}>Request a Want</PostWantButton></div>
      </div>
      <div className={styles.brandCard}>
        <Image src="/logo.png" alt="JORO" width={360} height={210} priority className={styles.logo} />
        <p className={styles.tagline}>Jo Chahiye, Yahin Mile!</p>
        <span>People. Needs. Connections.</span>
      </div>
    </header>

    <section className={styles.story} aria-labelledby="our-story">
      <div><p className={styles.eyebrow}>A practical starting point</p><h2 id="our-story">Our Story</h2></div>
      <div className={styles.prose}><p>Every day, people search for products, services and businesses across different shops, conversations and platforms. At the same time, sellers and service providers are looking for ways to reach the people who need them.</p><p>JORO began with the idea of making those connections easier in one convenient digital space. We are building it around Pakistan’s real marketplace needs, with simplicity, accessibility and useful everyday solutions guiding the work.</p><p>Our platform is developing. The direction is clear: bring discovery, requests and business participation closer together, one practical step at a time.</p></div>
    </section>

    <section className={styles.meaning} aria-labelledby="why-joro">
      <div><p className={styles.eyebrow}>The idea behind the name</p><h2 id="why-joro">Why JORO?</h2><p className={styles.lead}>JORO means bringing things together.</p><p>For us, the name represents connection: helping people move from “I need this” to discovering a product, a seller or a useful solution. It is the idea we build around.</p></div>
      <ul className={styles.connections}>{connections.map(([from, to]) => <li key={from}><span>{from}</span><ArrowRight aria-hidden="true" /><strong>{to}</strong></li>)}</ul>
    </section>

    <div className={styles.twoColumns}>
      <section className={styles.card} aria-labelledby="our-mission"><Compass aria-hidden="true" className={styles.sectionIcon} /><h2 id="our-mission">Our Mission</h2><p>To make everyday buying, selling and discovering services simpler, more accessible and more connected for people across Pakistan.</p><ul className={styles.tags}>{values.map(value => <li key={value}>{value}</li>)}</ul></section>
      <section className={styles.card} aria-labelledby="our-vision"><Link2 aria-hidden="true" className={styles.sectionIcon} /><h2 id="our-vision">Our Vision</h2><p>To build a connected digital marketplace where people can discover what they need, businesses can find new customers and useful opportunities become easier to access.</p><p className={styles.note}>This is the future we are working towards, with the platform growing around real needs.</p></section>
    </div>

    <section className={styles.section} aria-labelledby="what-joro-offers"><p className={styles.eyebrow}>Useful ways to participate</p><h2 id="what-joro-offers">What You Can Do on JORO</h2><p className={styles.sectionIntro}>Start with a product, a service or a request. Accounts are required for personal actions such as posting Wants and saving items.</p><div className={styles.featureGrid}>{features.map(({ Icon, title, text, href, action }) => <div key={title} className={styles.feature}><Icon aria-hidden="true" /><h3>{title}</h3><p>{text}</p><Link href={href}>{action} <ArrowRight aria-hidden="true" /></Link></div>)}</div></section>

    <section className={styles.section} aria-labelledby="founders"><p className={styles.eyebrow}>The people building JORO</p><h2 id="founders">Meet the Founders</h2><p className={styles.sectionIntro}>JORO is being developed by Hamid Khan and Irtiza with a shared vision of making everyday marketplace experiences simpler, more connected and more accessible.</p><div className={styles.twoColumns}>{[{ name: "Hamid Khan", initials: "HK" }, { name: "Irtiza", initials: "I" }].map(founder => <div className={styles.founder} key={founder.name}><span aria-hidden="true" className={styles.avatar}>{founder.initials}</span><div><h3>{founder.name}</h3><p>Founder &amp; Owner, JORO</p></div></div>)}</div></section>

    <section className={styles.story} aria-labelledby="real-needs"><div><p className={styles.eyebrow}>Everyday problems, useful connections</p><h2 id="real-needs">Built Around Real Needs</h2></div><div className={styles.prose}><p>Finding the right product or service can mean searching in several places. Small businesses also need digital visibility and a way to discover customers who are already interested.</p><p>JORO aims to bring these activities together: a place to explore listings, express a requirement and discover relevant sellers. The focus is on making the next step easier for people on both sides of the marketplace.</p></div></section>

    <section id="grow-with-joro" className={styles.seller} aria-labelledby="grow-heading"><div><p className={styles.eyebrow}>For sellers &amp; service providers</p><h2 id="grow-heading">Grow with JORO</h2><p>Give your business a place to be discovered. Present products, explore customer requirements and participate in a marketplace built around useful connections. Opportunities depend on your offering and customer needs.</p></div><Link className={styles.primary} href="/sell">Become a Seller <ArrowRight aria-hidden="true" /></Link></section>

    <section className={styles.partnership} aria-labelledby="partnerships"><p className={styles.eyebrow}>Investors &amp; strategic partners</p><h2 id="partnerships">Build the Future with JORO</h2><p className={styles.lead}>We are building JORO with a long-term vision for a more connected digital marketplace in Pakistan.</p><p>We welcome meaningful conversations with individuals and organizations interested in learning about our vision, exploring partnerships and understanding the opportunities ahead.</p><ul className={styles.tags}>{direction.map(item => <li key={item}>{item}</li>)}</ul><Link href="mailto:admin@joro.pk" className={styles.primary}>Explore Partnership Opportunities <ArrowRight aria-hidden="true" /></Link><div id="partnership-contact" className={styles.contactReview}><h3>Partnership enquiries</h3><p>For business, investor and strategic partnership enquiries, email <a href="mailto:admin@joro.pk">admin@joro.pk</a>.</p><p>For help using JORO, visit our <Link href="/account/help">existing support centre</Link>. Sending a support ticket requires a customer account.</p></div></section>

    <section className={styles.closing} aria-labelledby="journey"><h2 id="journey">Be Part of the JORO Journey</h2><p>Whether you’re here to discover products, grow your business or explore new opportunities, we’d love to connect.</p><div className={styles.actions}><Link href="/products" className={styles.primary}>Explore JORO <ArrowRight aria-hidden="true" /></Link><Link href="/sell" className={styles.secondary}>Become a Seller</Link><Link href="/account/help" className={styles.textLink}>Contact Us</Link></div></section>
  </article>;
}
