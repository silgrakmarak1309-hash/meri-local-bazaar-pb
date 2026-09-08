FROM alpine:latest

RUN apk add --no-cache unzip wget ca-certificates

RUN wget https://github.com

RUN mkdir /pb && unzip pocketbase_0.22.21_linux_amd64.zip -d /pb/ && rm pocketbase_0.22.21_linux_amd64.zip

EXPOSE 8080

CMD ["/pb/pocketbase", "serve", "--http=0.0.0.0:8080"]
