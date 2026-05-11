# 🤖 ServeBot AI

> Next-generation e-commerce intelligence. Built with MongoDB Aggregation and Gemini AI.

**ServeBot AI** is an advanced, AI-driven e-commerce platform featuring a natural language customer assistant and a powerful administrative command center.

### 👨‍💻 Development Team
* **Ahmed Hassan** - Backend Architect & Database Engineer
* **Usman** - Frontend Developer & UI/UX Designer

---

## ✨ Core Capabilities

### 🛒 AI Assistant (Customer-Facing)
* **Natural Language Processing:** Powered by Google Gemini to understand complex queries and casual conversation.
* **Real-Time Inventory Access:** The bot dynamically checks live stock levels and prices using full-text database searches.
* **Instant Order Processing:** Securely places orders and deducts stock seamlessly.
* **History Retrieval:** Customers can instantly pull up past orders and payment statuses.
* **Markdown UI:** Formats product lists and receipts into clean, readable UI tables using Marked.js.

### 👑 Command Center (Admin-Facing)
* **Live Aggregation Analytics:** Tracks global revenue and ranks top spenders using interactive Chart.js graphs powered by MongoDB Aggregation Pipelines.
* **Inventory Management:** Full CRUD capabilities with an intuitive glassmorphism UI.
* **Automated Audit Trails:** Secretly logs manual price changes and stock overrides for complete accountability.
* **Soft Deletion:** Safely removes products from active inventory without breaking historical order receipts.

---

## 🧠 Advanced Database Architecture (ADB)
This project moves heavy computational logic directly into the MongoDB engine to ensure performance, security, and scalability.

* **Data Lifecycle Management:** Automated TTL (Time-To-Live) indexes automatically prune old chat sessions.
* **Offloaded Computation:** Multi-stage Aggregation Pipelines calculate analytics natively inside the database.
* **Schema-Level Constraints:** Pre-save Mongoose middleware physically rejects invalid data (e.g., negative stock).
* **Referential Integrity:** Custom query controllers intercept read operations to support Soft Deletes.
* **Full-Text Indexing:** Inverted indexes on product names enable lightning-fast AI search capabilities.

---

## 🛠️ Tech Stack
* **Backend:** Node.js, Express.js
* **Database:** MongoDB, Mongoose
* **AI Integration:** Google Generative AI SDK (Gemini 2.5 Flash)
* **Frontend:** HTML5, CSS3, Vanilla JavaScript, Chart.js, Marked.js

---