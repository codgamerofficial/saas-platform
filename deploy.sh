#!/bin/bash

# SaaS Platform Deployment Script
# This script helps deploy the application to various platforms

set -e

echo "🚀 SaaS Platform Deployment Script"
echo "=================================="

# Function to deploy frontend to Netlify
deploy_to_netlify() {
    echo "📦 Deploying frontend to Netlify..."

    # Check if Netlify CLI is installed
    if ! command -v netlify &> /dev/null; then
        echo "Installing Netlify CLI..."
        npm install -g netlify-cli
    fi

    # Build frontend
    echo "Building frontend..."
    cd frontend
    npm install
    npm run build
    cd ..

    # Deploy to Netlify
    echo "Deploying to Netlify..."
    cd frontend
    netlify deploy --prod --dir=build
    cd ..

    echo "✅ Frontend deployed to Netlify successfully!"
}

# Function to deploy backend to Railway
deploy_to_railway() {
    echo "🚂 Deploying backend to Railway..."

    # Check if Railway CLI is installed
    if ! command -v railway &> /dev/null; then
        echo "Installing Railway CLI..."
        curl -fsSL https://railway.app/install.sh | sh
    fi

    # Deploy backend
    echo "Deploying backend to Railway..."
    cd backend
    railway deploy
    cd ..

    echo "✅ Backend deployed to Railway successfully!"
}

# Function to deploy backend to Heroku
deploy_to_heroku() {
    echo "🏗️ Deploying backend to Heroku..."

    # Check if Heroku CLI is installed
    if ! command -v heroku &> /dev/null; then
        echo "Installing Heroku CLI..."
        curl https://cli-assets.heroku.com/install.sh | sh
    fi

    # Create Heroku app if it doesn't exist
    if ! heroku apps --all | grep -q "saas-platform-backend"; then
        echo "Creating Heroku app..."
        heroku create saas-platform-backend
    fi

    # Set environment variables
    echo "Setting environment variables..."
    heroku config:set NODE_ENV=production
    heroku config:set MONGODB_URI=$MONGODB_URI
    heroku config:set JWT_SECRET=$JWT_SECRET
    heroku config:set OPENAI_API_KEY=$OPENAI_API_KEY

    # Deploy to Heroku
    echo "Deploying to Heroku..."
    git push heroku master

    echo "✅ Backend deployed to Heroku successfully!"
}

# Function to deploy backend to DigitalOcean App Platform
deploy_to_digitalocean() {
    echo "🌊 Deploying backend to DigitalOcean App Platform..."

    # Check if doctl is installed
    if ! command -v doctl &> /dev/null; then
        echo "Installing doctl..."
        curl -fsSL https://api.github.com/repos/digitalocean/doctl/releases/latest | grep "browser_download_url.*linux-amd64" | cut -d '"' -f 4 | xargs curl -fsSL | sudo tar -xz -C /usr/local/bin
    fi

    echo "Deploying to DigitalOcean App Platform..."
    echo "Please connect your GitHub repository to DigitalOcean App Platform manually."
    echo "Repository: https://github.com/codgamerofficial/saas-platform"
    echo "Build Command: cd backend && npm install && npm run build"
    echo "Start Command: npm start"

    echo "✅ Please complete DigitalOcean deployment in the dashboard!"
}

# Function to setup MongoDB Atlas
setup_mongodb() {
    echo "🍃 Setting up MongoDB Atlas..."

    if ! command -v mongosh &> /dev/null; then
        echo "Installing MongoDB Shell..."
        # Installation instructions for different OS
        echo "Please install MongoDB Shell from: https://docs.mongodb.com/mongodb-shell/install/"
    fi

    echo "MongoDB Atlas Setup:"
    echo "1. Go to https://cloud.mongodb.com"
    echo "2. Create a new cluster (free tier available)"
    echo "3. Create database user and get connection string"
    echo "4. Whitelist your IP address"
    echo "5. Set MONGODB_URI in your environment variables"

    echo "✅ MongoDB Atlas setup instructions provided!"
}

# Main deployment menu
echo ""
echo "Select deployment option:"
echo "1) Deploy frontend to Netlify"
echo "2) Deploy backend to Railway"
echo "3) Deploy backend to Heroku"
echo "4) Deploy backend to DigitalOcean"
echo "5) Setup MongoDB Atlas"
echo "6) Deploy everything (Full Stack)"
echo ""
read -p "Enter your choice (1-6): " choice

case $choice in
    1)
        deploy_to_netlify
        ;;
    2)
        deploy_to_railway
        ;;
    3)
        deploy_to_heroku
        ;;
    4)
        deploy_to_digitalocean
        ;;
    5)
        setup_mongodb
        ;;
    6)
        echo "🚀 Deploying full stack application..."
        setup_mongodb
        deploy_to_heroku
        deploy_to_netlify
        echo "✅ Full stack deployment completed!"
        ;;
    *)
        echo "Invalid option. Please run the script again."
        exit 1
        ;;
esac

echo ""
echo "🎉 Deployment script completed!"
echo ""
echo "Next steps:"
echo "1. Update your frontend .env.production with the correct backend URL"
echo "2. Set up environment variables in your deployment platform"
echo "3. Test your deployed application"
echo "4. Update DNS settings if needed"
echo ""
echo "Happy deploying! 🚀"