# **Technical Documentation: Long-Term Car Rental Platform**

**Client:** Euro Abschlepdienst (via new application name)

**Target Market:** Switzerland (Requires FADP and GDPR compliance)

## **1\. System Architecture & Tech Stack**

To ensure strict type safety, clean code, high performance, and easy maintenance, the project will be structured as a **Monorepo**.

| Component | Technology | Rationale |
| :---- | :---- | :---- |
| **Monorepo Management** | Turborepo / Nx | Excellent caching and fast build times for sharing types between Next.js and Node.js. |
| **Frontend (B2C & CMS)** | Next.js (React), Tailwind CSS | Native SEO capabilities (App Router), fast rendering, modern UI. |
| **Backend API** | Node.js \+ Express (or NestJS) | Built in TypeScript for strong typing, easy OpenAPI generation, and clean MVC architecture. |
| **Database & ORM** | PostgreSQL \+ Prisma ORM | Relational data handling (cars, availability, pricing) with absolute type safety. |
| **Caching** | Redis | Ideal for caching base car data, details, and API rate limiting. |
| **Deployment** | Docker, Nginx (Self-Hosted) | Containerized environment optimized for constrained hardware. Nginx handles reverse proxying and SSL (Let's Encrypt). |

## **2\. B2C Client Application**

The public-facing application is a no-login, mobile-first website focused on lead generation and SEO.

### **Core Functionality**

* **Mobile-First UI:** Responsive design prioritizing mobile devices, featuring a sleek, modern interface for browsing available vehicles.  
* **Car Listings & Details:** Dynamic generation of car detail pages featuring image galleries, specifications, and dynamic pricing based on rental duration.  
* **Contact Form:** Secure form allowing users to inquire about specific vehicles.

### **SEO, Analytics & Compliance**

* **Google Tools Integration:** \* **Google Search Console (GSC):** Connected via meta tag or DNS for indexing the dynamic car pages.  
  * **Google Analytics 4 (GA4) & GTM:** Implemented to track user behavior and contact form conversions.  
* **Cookie Consent Banner:** A strict consent manager blocking GA4 and any tracking scripts until explicit user opt-in, ensuring compliance with the Swiss Federal Act on Data Protection (FADP) and EU GDPR.  
* **SEO Optimization:** Automated generation of sitemap.xml, robots.txt, and dynamic Open Graph tags for optimal search engine visibility.

## **3\. Business CMS (Admin Application)**

The administrative control panel, isolated from the B2C frontend but residing in the same monorepo.

### **Access & Security**

* **Hidden Login:** The authentication portal is accessible via an obscure footer link on the B2C site or a specific unlisted URL path.  
* **First-Login Reset:** Forced password update upon the initial login of any newly created admin account.  
* **Authentication:** Secure JWT (JSON Web Token) implementation featuring short-lived access tokens and secure, HTTP-only refresh tokens.

### **Fleet & Content Management**

* **Vehicle CRUD:** Interfaces to add, edit, and remove vehicles, including descriptions and technical details.  
* **Media Management:** Upload interface allowing admins to upload multiple photos to the shared Docker volume, select the primary thumbnail, and reorder images.  
* **Calendar & Availability:** Visual calendar interface for manual fleet tracking, marking specific dates or ranges as booked or unavailable. Timezone handling must strictly convert local Swiss time (CET/CEST) to UTC for database storage.  
* **Dynamic Pricing Engine:** A module to define base daily rates and configure discount breakpoints (e.g., Days 1-7: 100 CHF/day, Days 8-30: 20% off, Days 31+: 40% off).

### **Reporting & Lead Management**

* **Statistics Dashboard:** Visual metrics showing total revenue, vehicle utilization rates, and average rental durations.  
* **Contact Requests:** A CRM-style table to view, manage, and respond to incoming user inquiries from the B2C site.

## **4\. Backend API & Integrations**

### **API Design**

* **OpenAPI Standard:** Fully documented RESTful API using Swagger/OpenAPI specifications. This serves as the single source of truth for frontend data fetching and type generation.  
* **Caching Strategy:** Implementation of Redis to cache the list of available cars and individual car details. Cache is invalidated via webhooks/events only when an admin updates a vehicle.

### **Integrations**

* **Brevo (Email & SMS):** Integrated via their official Node.js SDK. Used to send automated notifications to admins upon new contact form submissions, and automated confirmation receipts to the user.  
* **Webhook Listeners:** Endpoints designed to receive external triggers (e.g., from Brevo or future payment gateways) and act as internal event emitters without blocking the main API response.

## **5\. Self-Hosting Infrastructure (NUC Setup)**

Given the application will be self-hosted on a physical Intel NUC (8GB RAM, 256GB Storage), specific optimizations and maintenance protocols are critical.

### **Resource Management & Optimization**

* **Storage Constraints (256GB Limit):** To prevent disk exhaustion from uncompressed car photos, the backend *must* implement aggressive image optimization. Uploaded images will be processed using the sharp library in Node.js to resize and convert them to highly efficient WebP or AVIF formats *before* saving to the shared volume.  
* **Memory Limits (8GB Limit):** The docker-compose.yml file will strictly define memory limits for each container. For example, Redis capped at 256MB, Next.js at 1GB, and PostgreSQL at 1.5GB, ensuring the host OS retains enough memory to operate smoothly without swapping.  
* **Log Rotation:** Docker container logs will be configured with strict size limits (e.g., max-size: "10m", max-file: "3") to prevent log files from silently consuming the 256GB drive over time.

### **File Handling & Networking**

* **Shared Uploads:** Both the API (for uploading) and Nginx (for serving) will mount a shared Docker volume (/uploads).  
* **Bandwidth Preservation:** Nginx is configured to serve the shared upload folder directly, bypassing Node.js, and applying heavy browser caching headers (Cache-Control: public, max-age=31536000) for static image assets.  
* **SSL Termination:** Nginx will be configured alongside Certbot (Let's Encrypt) to automatically provision and renew free SSL certificates for secure HTTPS traffic.

### **Disaster Recovery (Critical)**

* **Off-site Backups:** Because physical hardware (especially a single SSD) can fail, an automated cron job must be established to run daily pg\_dump backups of the PostgreSQL database and rsync/rclone backups of the shared /uploads volume to a secure, off-site storage provider (e.g., AWS S3, Backblaze B2, or a secure company NAS).

## **6\. Estimated Development Timeline**

This estimate assumes one experienced full-stack developer working full-time (\~40 hours/week). Total estimated time: **6 to 8 weeks**.

| Phase | Duration | Key Deliverables |
| :---- | :---- | :---- |
| **Week 1: Foundation** | 1 Week | Monorepo setup, DB schema design, OpenAPI spec drafting, Docker/Nginx local environment configuration. |
| **Week 2: Backend Core** | 1 Week | JWT auth, refresh tokens, vehicle CRUD endpoints, image compression (sharp) & upload processing, Redis setup. |
| **Week 3: Business Logic** | 1 Week | Availability calendar logic, timezone normalizations, dynamic pricing calculation algorithm, statistics aggregation. |
| **Week 4: Admin CMS** | 1 Week | Hidden login UI, dashboard UI, vehicle management forms, image thumbnail selector, calendar interface. |
| **Week 5: B2C App** | 1 Week | Mobile-first UI development, car listing grid, dynamic detail pages, pricing calculator UI. |
| **Week 6: Integrations** | 1 Week | Contact form linkage, Brevo email/SMS setup, Google Analytics/GSC injection, FADP-compliant Cookie consent banner. |
| **Week 7: Polish & Deploy** | 1-2 Weeks | E2E testing, bug fixing, NUC server setup (Docker, Nginx, UFW, Let's Encrypt, Backup Cron Jobs), final launch. |

