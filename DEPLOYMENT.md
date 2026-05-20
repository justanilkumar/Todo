# TaskFlow Deployment Guide: AWS Cloud Hosting (EC2, S3, MongoDB Atlas)

This guide provides step-by-step instructions to deploy the **TaskFlow** application to AWS. 

We will host the unified Node.js/Express server (serving the compiled React UI) on an **AWS EC2 Instance**, configure **MongoDB Atlas** for database storage, and connect **AWS S3** for attachment uploads.

---

## Architecture Overview

```mermaid
graph TD
    User([User Browser]) -->|HTTP Port 80 / HTTPS 443| Nginx[Nginx Reverse Proxy]
    Nginx -->|Port 5050| Express[Express Node.js Server]
    Express -->|Serves Static Files| React[Vite React Frontend]
    Express -->|CRUD Operations| MongoDB[(MongoDB Atlas Cloud DB)]
    Express -->|Attachment Uploads| S3[(AWS S3 Bucket)]
```

---

## Phase 1: Database Setup (MongoDB Atlas)

To avoid overloading our Free-Tier EC2 instance with a local database, we use MongoDB Atlas (the official free cloud database service).

1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) and sign up for a free account.
2. Click **Create Cluster** and select the **M0 (Free)** tier.
3. Select **AWS** as the provider and choose your closest region.
4. Under **Security Quickstart**:
   - Create a database user (e.g., `db_user`) and a secure password. Save these credentials.
   - Under **IP Access List**, select **Allow Access from Anywhere** (`0.0.0.0/0`) for testing, or add your EC2 instance's Elastic IP once provisioned.
5. Once the cluster is deployed, click **Connect** -> **Drivers** -> **Node.js**.
6. Copy the **Connection String**. It will look like this:
   ```text
   mongodb+srv://db_user:<password>@cluster0.xxxx.mongodb.net/taskflow?retryWrites=true&w=majority
   ```
   *(Note: Remember to replace `<password>` with your database user's actual password).*

---

## Phase 2: File Storage Setup (AWS S3)

To enable persistent cloud uploads for task attachments:

1. Log into your **AWS Management Console** and navigate to the **S3** service.
2. Click **Create bucket**.
   - Choose a unique **Bucket name** (e.g., `taskflow-attachments-yourname`).
   - Select your preferred **AWS Region**.
3. Under **Object Ownership**, choose **ACLs disabled** (recommended).
4. Under **Block Public Access settings for this bucket**:
   - For demo purposes, if you want users to view/download attachments directly from S3, **uncheck** "Block *all* public access".
   - Acknowledge the warning that the bucket will become public.
5. Click **Create bucket**.
6. **Configure Public Access Policy:**
   - Click on your new bucket, go to the **Permissions** tab.
   - Scroll down to **Bucket policy** and click **Edit**.
   - Paste the following policy (replace `YOUR-BUCKET-NAME` with your actual bucket name):
     ```json
     {
       "Version": "2012-10-17",
       "Statement": [
         {
           "Sid": "PublicReadGetObject",
           "Effect": "Allow",
           "Principal": "*",
           "Action": "s3:GetObject",
           "Resource": "arn:aws:s3:::YOUR-BUCKET-NAME/*"
         }
       ]
     }
     ```
   - Click **Save changes**.

7. **Create IAM Security Credentials:**
   - Go to **IAM (Identity and Access Management)** in the AWS Console.
   - Click **Users** -> **Create user**. Name it `taskflow-s3-user`.
   - On the permissions page, select **Attach policies directly**.
   - Search for and check **AmazonS3FullAccess** (or create a custom policy restricting access to only your specific bucket).
   - Complete user creation.
   - Click on the created user -> **Security credentials** tab.
   - Scroll to **Access keys** and click **Create access key**. Select **Command Line Interface (CLI)**, accept tags, and click create.
   - Copy the **Access Key ID** and **Secret Access Key**. Save these securely!

---

## Phase 3: Launching the AWS EC2 Instance

1. Navigate to the **EC2** Dashboard in your AWS Console.
2. Click **Launch instance**.
   - **Name:** `TaskFlow-Server`
   - **OS Image (AMI):** Select **Ubuntu Server 24.04 LTS** (Free Tier eligible).
   - **Instance Type:** `t2.micro` (or `t3.micro` depending on region, Free Tier eligible).
   - **Key pair:** Click **Create new key pair**. Select `RSA` and `.pem` format. Download and save the key pair file (e.g., `taskflow-key.pem`) securely.
3. Under **Network settings**:
   - Check **Allow SSH traffic from** (Select `My IP` for safety, or `Anywhere` for testing).
   - Check **Allow HTTPS traffic from the internet**.
   - Check **Allow HTTP traffic from the internet**.
4. Click **Launch instance**.
5. Once running, find your instance in the list and copy its **Public IPv4 Address** (e.g., `54.210.12.34`).

---

## Phase 4: Setting up the Server environment (SSH connection)

Open your local terminal and navigate to the directory where your private key (`taskflow-key.pem`) is saved:

1. **Set Key Permissions (macOS/Linux only):**
   ```bash
   chmod 400 taskflow-key.pem
   ```
2. **Connect to the Instance:**
   ```bash
   ssh -i "taskflow-key.pem" ubuntu@YOUR_EC2_PUBLIC_IP
   ```
   *(Type `yes` when prompted to verify host authenticity).*

3. **Install Node.js (v20 LTS), Git, and build tools:**
   ```bash
   # Update system packages
   sudo apt update && sudo apt upgrade -y

   # Install Node.js v20 via NodeSource
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt-get install -y nodejs

   # Verify versions
   node -v
   npm -v
   ```

4. **Install Nginx & PM2 Process Manager:**
   ```bash
   # Install Nginx
   sudo apt install nginx -y

   # Install PM2 globally
   sudo npm install pm2 -g
   ```

---

## Phase 5: Cloning and Configuring the Application

1. **Clone the project code:**
   ```bash
   git clone https://github.com/justanilkumar/10x.git todo-app
   cd todo-app/"Todo App"
   ```
   *(Note: Adjust the Git repository URL above to point to your specific repository path).*

2. **Install all dependencies (Root backend + React frontend):**
   ```bash
   npm run install-all
   ```

3. **Set up Environment Variables:**
   Create a production `.env` file in the root directory:
   ```bash
   nano .env
   ```
   Paste the following variables and fill in your actual credentials:
   ```env
   PORT=5050
   NODE_ENV=production
   MONGODB_URI=mongodb+srv://db_user:password@cluster0.xxxx.mongodb.net/taskflow?retryWrites=true&w=majority

   # S3 Credentials
   AWS_ACCESS_KEY_ID=YOUR_IAM_ACCESS_KEY_ID
   AWS_SECRET_ACCESS_KEY=YOUR_IAM_SECRET_ACCESS_KEY
   AWS_REGION=YOUR_AWS_REGION
   AWS_BUCKET_NAME=YOUR_S3_BUCKET_NAME
   ```
   Press `CTRL + O`, then `Enter` to save, and `CTRL + X` to exit.

4. **Build the Frontend Assets:**
   ```bash
   npm run build
   ```
   This will compile the React bundle into `/frontend/dist`. The Express backend is configured to detect this directory and serve it automatically.

---

## Phase 6: Running the Server & Reverse Proxy Configuration

1. **Start the Express backend using PM2:**
   ```bash
   pm2 start server.js --name "taskflow"
   ```
   - To make sure PM2 restarts the server when the EC2 instance reboots:
     ```bash
     pm2 startup systemd
     ```
     *(Copy and run the command generated by the output of the above command).*
     ```bash
     pm2 save
     ```

2. **Configure Nginx as a Reverse Proxy:**
   We need Nginx to capture HTTP port 80 traffic and forward it internally to our Node server running on port 5050.
   ```bash
   # Remove default nginx config
   sudo rm /etc/nginx/sites-enabled/default

   # Create a new config file
   sudo nano /etc/nginx/sites-available/taskflow
   ```

   Paste the following configuration:
   ```nginx
   server {
       listen 80;
       server_name _; # Or replace with your domain name (e.g. todo.example.com)

       # Max file upload size (matches our multer 10MB limit)
       client_max_body_size 10M;

       location / {
           proxy_pass http://127.0.0.1:5050;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
       }
   }
   ```
   Save and exit (`CTRL + O`, `Enter`, `CTRL + X`).

3. **Enable Nginx configuration and restart service:**
   ```bash
   # Enable configuration link
   sudo ln -s /etc/nginx/sites-available/taskflow /etc/nginx/sites-enabled/

   # Test config syntax
   sudo nginx -t

   # Restart Nginx
   sudo systemctl restart nginx
   ```

---

## Phase 7: Verification

Open a web browser and navigate to your EC2 instance's **Public IPv4 Address** (e.g., `http://54.210.12.34`).
- You should see the premium glassmorphic **TaskFlow** interface load instantly!
- You can create, complete, edit, and delete tasks.
- If S3 is configured, upload a file and see it load directly from your AWS S3 bucket.
