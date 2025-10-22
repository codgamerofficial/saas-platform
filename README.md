# 🚀 SaaS Platform - AI-Powered Media Tools with 3D UI

A comprehensive, modern SaaS platform featuring AI-powered tools, social media integration, and a stunning 3D user interface built with React Three Fiber and glass morphism design.

![SaaS Platform](https://img.shields.io/badge/Status-Production%20Ready-brightgreen)
![React](https://img.shields.io/badge/React-18.2.0-blue)
![Node.js](https://img.shields.io/badge/Node.js-18.0+-green)
![MongoDB](https://img.shields.io/badge/MongoDB-5.0+-red)
![Three.js](https://img.shields.io/badge/Three.js-0.158.0-black)

## ✨ Features

### 🖼️ **Image Processing Tools**
- **Image Resize** - Resize images with aspect ratio control
- **Image Compression** - Reduce file size while maintaining quality
- **Quality Enhancement** - Sharpen, blur, brightness, and contrast adjustments
- **Background Removal** - Remove backgrounds from images
- **Upload Management** - Drag-and-drop file uploads with progress tracking

### 📄 **Document Conversion Tools**
- **Text to DOC** - Convert text content to Word documents
- **Text to PDF** - Generate professional PDFs from text
- **Text to Excel** - Create spreadsheets from structured text
- **Excel to CSV** - Convert Excel files to CSV format
- **Batch Processing** - Handle multiple files simultaneously

### 🤖 **AI-Powered Features**
- **Image to Text** - Extract text from images using OCR and AI vision
- **Text to Image** - Generate images from text prompts (DALL-E 3)
- **Image Analysis** - AI-powered content analysis and description
- **Text Enhancement** - Grammar correction and style improvement
- **Content Summarization** - Intelligent text summarization

### 🎥 **Social Media Video Downloaders**
- **YouTube Downloader** - Download videos in multiple quality options
- **Instagram Downloader** - Support for posts, reels, and IGTV (public/private)
- **Facebook Downloader** - Download Facebook videos
- **Batch Downloads** - Process multiple videos simultaneously
- **Format Selection** - Choose from various video formats

### ✍️ **Signature & Photo Tools**
- **Signature Maker** - Create digital signatures with custom fonts
- **Passport Photo Maker** - Generate compliant passport photos by country
- **ID Photo Generator** - Create ID card photos for various formats
- **QR Code Generator** - Generate QR codes for any content
- **Meme Generator** - Create memes with custom text overlays

## 🎨 **Modern 3D Design**

### **Visual Features**
- **Glass Morphism UI** - Modern glass-like interface elements
- **3D Animations** - Smooth 3D transitions and hover effects
- **Floating Elements** - Animated 3D text and graphics
- **Gradient Backgrounds** - Dynamic color gradients and effects
- **Responsive Cards** - Interactive 3D cards with depth

### **Interactive Elements**
- **3D Buttons** - Buttons with depth, shadows, and animations
- **Loading Animations** - Custom 3D loading spinners
- **Hover Effects** - Enhanced hover states with 3D transformations
- **Particle Systems** - Animated background particles
- **Smooth Transitions** - Fluid animations between states

## 🛠️ **Technical Stack**

### **Backend**
- **Node.js** - Server-side JavaScript runtime
- **Express.js** - Web application framework
- **MongoDB** - NoSQL database with Mongoose ODM
- **JWT Authentication** - Secure token-based authentication
- **Sharp** - High-performance image processing
- **PDFKit & ExcelJS** - Document generation libraries
- **OpenAI API** - AI-powered features integration

### **Frontend**
- **React 18** - Modern React with hooks and concurrent features
- **React Three Fiber** - Declarative 3D graphics for React
- **Three.js** - 3D graphics library
- **Styled Components** - CSS-in-JS styling
- **React Query** - Data fetching and caching
- **React Router** - Client-side routing
- **Framer Motion** - Animation library

### **Development Tools**
- **Vite** - Fast build tool and dev server
- **ESLint** - Code linting and formatting
- **Prettier** - Code formatting
- **Jest** - Testing framework
- **Git Hooks** - Pre-commit quality checks

## 🚀 **Quick Start**

### **Prerequisites**
- Node.js 18.0 or higher
- MongoDB 5.0 or higher
- Git

### **Installation**

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/saas-platform.git
   cd saas-platform
   ```

2. **Install dependencies**
   ```bash
   npm run install-all
   ```

3. **Environment Setup**
   ```bash
   # Copy environment template
   cp backend/.env.example backend/.env

   # Configure your environment variables
   nano backend/.env
   ```

4. **Start development servers**
   ```bash
   npm run dev
   ```

5. **Access the application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:5000

## 📁 **Project Structure**

```
saas-platform/
├── backend/                 # Node.js/Express backend
│   ├── controllers/         # Route controllers
│   ├── middleware/          # Custom middleware
│   ├── models/             # MongoDB models
│   ├── routes/             # API routes
│   ├── utils/              # Utility functions
│   └── server.js           # Main server file
├── frontend/               # React frontend
│   ├── src/
│   │   ├── components/     # Reusable components
│   │   ├── pages/          # Page components
│   │   ├── hooks/          # Custom React hooks
│   │   ├── context/        # React context providers
│   │   ├── styles/         # Global styles and themes
│   │   └── App.js          # Main app component
│   └── public/             # Static assets
├── uploads/                # File uploads directory
├── temp/                   # Temporary files
└── README.md
```

## 🔧 **Configuration**

### **Environment Variables**

Create a `backend/.env` file with the following variables:

```env
# Server Configuration
NODE_ENV=development
PORT=5000
FRONTEND_URL=http://localhost:3000

# Database
MONGODB_URI=mongodb://localhost:27017/saas-platform

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-here
JWT_EXPIRE=7d

# OpenAI Configuration (for AI features)
OPENAI_API_KEY=your-openai-api-key-here

# Email Configuration (optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Stripe Configuration (for payments)
STRIPE_SECRET_KEY=sk_test_your-stripe-secret-key
STRIPE_PUBLISHABLE_KEY=pk_test_your-stripe-publishable-key
```

## 🎯 **Usage Examples**

### **Image Processing**
```javascript
// Resize an image
const response = await fetch('/api/images/resize', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    fileId: 'image-id',
    width: 800,
    height: 600,
    maintainAspectRatio: true
  })
});
```

### **AI Text Generation**
```javascript
// Generate image from text
const response = await fetch('/api/ai/text-to-image', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    prompt: 'A futuristic city at sunset',
    style: 'photorealistic',
    size: '1024x1024'
  })
});
```

### **Document Conversion**
```javascript
// Convert text to PDF
const response = await fetch('/api/documents/convert/text-to-pdf', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    text: 'Your content here',
    title: 'My Document'
  })
});
```

## 🔐 **Authentication**

The platform supports multiple authentication methods:

- **JWT Tokens** - Stateless authentication
- **Refresh Tokens** - Automatic token renewal
- **Role-based Access** - User, Admin, and Premium roles
- **Feature Limits** - Usage-based feature restrictions

## 💳 **Subscription Management**

- **Free Tier** - Limited usage for all features
- **Premium Tier** - Unlimited access with priority support
- **Admin Panel** - User and subscription management
- **Usage Analytics** - Track feature usage and costs

## 🌐 **API Documentation**

### **Core Endpoints**

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | User registration |
| POST | `/api/auth/login` | User authentication |
| POST | `/api/images/upload` | Upload image files |
| POST | `/api/images/resize` | Resize images |
| POST | `/api/ai/text-to-image` | Generate images from text |
| POST | `/api/videos/download/youtube` | Download YouTube videos |
| POST | `/api/tools/signature-maker` | Generate signatures |

## 🚀 **Deployment**

### **Production Deployment**

1. **Build the frontend**
   ```bash
   npm run build
   ```

2. **Configure production environment**
   ```bash
   # Set production environment variables
   NODE_ENV=production
   MONGODB_URI=your-production-mongodb-uri
   ```

3. **Deploy backend**
   ```bash
   cd backend
   npm start
   ```

4. **Serve frontend**
   - Use Nginx, Apache, or any static file server
   - Configure API proxy to backend server

### **Docker Deployment**

```dockerfile
# Backend Dockerfile
FROM node:18-alpine
WORKDIR /app
COPY backend/package*.json ./
RUN npm ci --only=production
COPY backend/ .
EXPOSE 5000
CMD ["npm", "start"]

# Frontend Dockerfile
FROM node:18-alpine as build
WORKDIR /app
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/build /usr/share/nginx/html
EXPOSE 80
```

## 🤝 **Contributing**

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### **Development Guidelines**
- Follow ESLint and Prettier configurations
- Write tests for new features
- Update documentation for API changes
- Use conventional commit messages

## 📝 **License**

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 **Acknowledgments**

- **OpenAI** for AI-powered features
- **React Three Fiber** community for 3D graphics
- **Sharp** for image processing capabilities
- **MongoDB** for reliable data storage

## 📞 **Support**

For support, email support@saasplatform.com or join our Discord community.

---

**⭐ Star this repository if you find it helpful!**

Made with ❤️ and lots of ☕ by the SaaS Platform team.