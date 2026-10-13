# Use the official Node.js image as the base image
FROM node:24

# Set the working directory inside the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json to the working directory
COPY package*.json ./

# Install the application dependencies
RUN npm install

# Copy the rest of the application files
COPY . .

# Build the NestJS application
RUN npm run build

# Make the entrypoint script executable
RUN chmod +x entrypoint.sh

# Starts the app and seeds the first Administrator user
CMD ["./entrypoint.sh"]