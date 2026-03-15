# **FADP & GDPR Compliance Handbook**

**For: Euro Abschlepdienst (Car Rental Platform)**

**Stack:** Next.js, Node.js, PostgreSQL, Docker (Self-Hosted on Intel NUC)

## **Introduction: Why This Matters**

As of September 1, 2023, the revised Swiss Federal Act on Data Protection (FADP) is in effect, aligning heavily with the EU's GDPR. Because this platform targets customers in Switzerland and potentially cross-border EU residents, it must comply with both.

**The Highest Risk:** Under the EU GDPR, companies receive fines. However, under the Swiss FADP, **the responsible natural person** (Managing Directors, and potentially Lead Developers) can be held personally liable and fined up to **250,000 CHF out of their own pocket** for intentional breaches of data security or information duties.

## **1\. Frontend & UI Requirements (Next.js B2C)**

### **A. The Contact Form**

The contact form is the primary point of data collection. It must adhere to the principle of "Data Minimization" and "Explicit Consent."

* **Minimal Fields:** Only ask for what is strictly necessary to process the rental inquiry (Name, Email, Phone, Message). Do not ask for home addresses or birth dates here.  
* **Mandatory Consent Checkbox:** You must include an **unchecked** box stating: *"I consent to the processing of my data to answer my request according to the Privacy Policy."* (Link to the policy).  
* **No Bundling:** If you want to use Brevo to send marketing newsletters later, you need a *second, completely separate, unchecked* box for marketing consent.

### **B. Cookie & Tracking Consent**

Because you are using Google Analytics 4 (GA4), you are transferring user behavior data to a US company.

* **Prior Consent (Zero-Cookie Load):** When the site loads, GA4 and any other tracking scripts **must be blocked**. They can only execute *after* the user clicks "Accept."  
* **No Dark Patterns:** The "Decline All" button must be visually identical (same size, similar color prominence) to the "Accept All" button.  
* **Granular Choice:** Users must be able to view and select which categories of cookies they accept (e.g., Essential, Analytics, Marketing).  
* **Withdrawal Link:** Place a small link or floating icon in the footer allowing users to reopen the banner and change their preferences at any time.

## **2\. Mandatory Legal Pages**

You must have two distinct pages linked in the footer of every single page on the B2C site.

### **A. Impressum (Legal Notice)**

Mandatory in Switzerland, Germany, and Austria. It must contain:

* Full company name (Euro Abschlepdienst) and legal form (e.g., GmbH, AG).  
* Physical registered address in Switzerland.  
* Direct contact information (Email and Phone number).  
* Commercial register number and VAT number (if applicable).  
* The name of the authorized representative/managing director.

### **B. Privacy Policy (Datenschutzerklärung)**

Must be written in clear, plain language explaining:

* **Who:** The identity and contact details of the data controller (Euro Abschlepdienst).  
* **What & Why:** What data is collected (contact form submissions, IP addresses) and why (to provide rental quotes, to analyze website traffic).  
* **Where (Third Parties):** You must explicitly list **Brevo** (for email routing) and **Google** (for analytics) and mention that data may be transferred to France/EU and the USA.  
* **User Rights:** Inform users they have the right to request a copy of their data, have it corrected, or have it deleted (Right to be Forgotten).

## **3\. Backend & Database (Node.js & PostgreSQL)**

### **A. Data Retention & Deletion**

You cannot store contact form inquiries forever.

* **Automated Cleanup:** Implement a scheduled cron job in your Node.js backend that automatically deletes or anonymizes contact requests in the PostgreSQL database after a defined period (e.g., 6 to 12 months) if they did not result in a signed rental contract.  
* **Soft Deletes:** If an admin deletes a contact request in the CMS, it must be permanently wiped from the database, not just hidden with a deleted\_at flag (unless legally required for tax/accounting purposes).

### **B. Audit Logging**

* The backend must log sensitive admin actions. If an admin logs into the CMS and downloads a CSV of user data, or deletes a vehicle/user, the Node.js app should log the Admin's User ID, the action, and the timestamp.

## **4\. Self-Hosting Security: TOMs (Technical & Organisational Measures)**

Because you are bypassing managed cloud providers (like AWS or Vercel) and hosting the database and application directly on a physical Intel NUC, **Euro Abschlepdienst is 100% legally responsible for infrastructure security.** The law requires you to implement TOMs. For your NUC setup, this means:

### **Technical Measures**

* **Encryption in Transit:** Nginx must be configured with a modern SSL/TLS certificate (Let's Encrypt) to ensure all data between the browser and the NUC is encrypted.  
* **Firewall:** The NUC must have a strict firewall (like UFW on Ubuntu) blocking all ports except 80 (HTTP), 443 (HTTPS), and a custom, non-standard port for SSH access.  
* **OS Updates:** The operating system and Docker engine on the NUC must be kept up to date with automated security patches.  
* **Encrypted Backups:** When backing up the PostgreSQL database and the /uploads folder to off-site storage (like AWS S3 or Backblaze), the backup files must be encrypted.

### **Organisational Measures**

* **Access Control:** The physical NUC must be locked in a secure room/cabinet at the company office. Only authorized IT personnel should know the SSH passwords.  
* **Strong Passwords:** The Next.js Admin CMS must enforce strong passwords and handle the "first-login reset" flawlessly.  
* **Incident Response:** If the NUC is stolen, or the server is hacked, you have a legal obligation to report the data breach to the FDPIC (Swiss Data Protection Commissioner) "as soon as possible."

## **5\. Developer & Admin Checklist**

* \[ \] **Frontend:** Implement a CMP (Consent Management Platform) like Cookiebot or build a strict, FADP-compliant custom banner.  
* \[ \] **Frontend:** Add unchecked consent checkboxes to the contact form.  
* \[ \] **Frontend:** Create the Impressum and Privacy Policy pages and link them in the footer.  
* \[ \] **Backend:** Write a cron job to delete old, unconverted contact inquiries after 12 months.  
* \[ \] **Backend:** Ensure the Brevo integration only sends emails to users who explicitly checked the consent box.  
* \[ \] **Infrastructure:** Configure UFW firewall on the NUC.  
* \[ \] **Infrastructure:** Setup automated, encrypted off-site database backups.  
* \[ \] **Admin:** Store the NUC securely in the office.