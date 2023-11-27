# Use the official Node.js base image
FROM node:14

# Install Git, nginx, and other dependencies
RUN apt-get update && \
    apt-get install -y git nginx

# Install pm2 globally
RUN npm install -g pm2

# Create a working directory for your application
WORKDIR /app

# Clone your Git project into the container
RUN git clone https://github.com/sheep1995/dcard-game.git .

# Install project dependencies
RUN npm install

# Download index.html (replace with your actual URL or copy from local)
RUN curl -o index.html https://dcard-super-z.s3.ap-northeast-1.amazonaws.com/index.html

#Set index.html as default
RUN cp index.html /var/www/html/index.html

# Set nginx server configuration
RUN cp nginx.conf /etc/nginx/nginx.conf


# Start the application with PM2
CMD ["pm2", "start", "app.js", "--no-daemon", "--time"]