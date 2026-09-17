export type Faq = { category: string; question: string; answer: string };

/** Static, server-rendered FAQ content -- never fetched from an API. */
export const CUSTOMER_FAQS: Faq[] = [
  { category: "ORDERS_DELIVERY", question: "Where is my order?", answer: "Open Account → Orders and select the order to see its live status and delivery estimate. Cash on Delivery orders show tracking once the seller ships them." },
  { category: "ORDERS_DELIVERY", question: "Can I cancel an order?", answer: "You can cancel from the order detail page while it is still pending, confirmed, or processing. Once an item has shipped, cancellation is no longer available there — create a ticket instead." },
  { category: "PAYMENT", question: "What payment methods are supported?", answer: "JORO currently supports Cash on Delivery (COD) in the cities listed at checkout." },
  { category: "RETURN_REFUND", question: "How do I request a return or refund?", answer: "Open the order, choose the item, and start a return request with a reason. The seller reviews it and a refund is issued once the return is accepted." },
  { category: "PRODUCT_ISSUE", question: "I received the wrong or a damaged product.", answer: "Start a return request from the order with the reason \"Damaged\" or \"Wrong item\", and attach a photo if you have one. If you need more help, create a ticket and reference the order." },
  { category: "WANTS_OFFERS", question: "How do Wants and Offers work?", answer: "Post what you're looking for as a Want. Approved sellers can send you offers; you can compare them, counter, and accept the one you like — acceptance adds it to your cart for checkout." },
  { category: "SERVICES", question: "How do I book or manage a service?", answer: "Services booked with an order appear under Account → Services / My Stuff, including their scheduled date and status." },
  { category: "FAMILY_CART", question: "What is Family Cart?", answer: "Family Cart (JORO Together) lets you shop a shared cart with friends or family in real time before checking out together." },
  { category: "ACCOUNT", question: "How do I update my profile or addresses?", answer: "Manage these under Account → Profile and Account → Addresses." },
  { category: "SELLER_ISSUE", question: "I have an issue with a seller.", answer: "Most seller issues (wrong item, no response, item not as described) are best resolved via a Return/Refund request first. If it's unresolved, create a support ticket and reference the order or seller." },
];

export const VENDOR_FAQS: Faq[] = [
  { category: "ORDERS", question: "Where do I manage incoming orders?", answer: "Vendor Dashboard → My Orders shows every order assigned to your store with its current status." },
  { category: "PRODUCTS", question: "How do I add or edit products?", answer: "Vendor Dashboard → My Products lets you create, edit, and manage stock for your catalog." },
  { category: "STORE", question: "How do I update my store page?", answer: "Vendor Dashboard → Settings / Store lets you edit your shop name, logo, banner, and description shown on your public store page." },
  { category: "WANTS_OFFERS", question: "How do I respond to customer Wants?", answer: "Vendor Dashboard → Customer Demand shows open Wants matching your store. Vendor Dashboard → Offers lets you manage every offer thread you've sent." },
  { category: "SERVICES", question: "How do I offer services?", answer: "Configure service offerings from Vendor Dashboard → Services; bookings appear alongside their related order." },
  { category: "EARNINGS_WITHDRAWALS", question: "How do withdrawals work?", answer: "Vendor Dashboard → My Earnings shows your available balance; request a payout from Vendor Dashboard → Withdrawals." },
  { category: "ACCOUNT_VERIFICATION", question: "Why is my account pending or suspended?", answer: "Check Vendor Dashboard → Account Status for the current state and any reason provided. You can appeal or create a ticket if you need more help." },
  { category: "PROMOTIONS_TOP_VENDOR", question: "How do I get featured or become a Top Vendor?", answer: "Featured placements and Top Vendor selection are curated by the JORO team. Create a ticket if you'd like to be considered." },
  { category: "TECHNICAL", question: "I'm seeing an error or a page won't load.", answer: "Try refreshing or signing out and back in first. If it persists, create a ticket describing what you were doing and any error message shown." },
];
