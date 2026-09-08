FROM alpine:latest

# Zaroori tools install karne ke liye
RUN apk add --no-cache unzip wget ca-certificates

# PocketBase download karne ke liye simple command
RUN wget https://github.com

# File ko extract karne ke liye
RUN mkdir /pb && unzip pocketbase_0.22.54_linux_amd64.zip -d /pb/ && rm pocketbase_0.22.54_linux_amd64.zip

# Port selection
EXPOSE 8080

# PocketBase ko start karne ka command
CMD ["/pb/pocketbase", "serve", "--http=0.0.0.0:8080"]
