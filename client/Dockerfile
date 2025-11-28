# Stage 1: Build React app
FROM node:20-alpine AS builder

WORKDIR /app

# package.json 복사 및 의존성 설치
COPY package*.json ./
RUN npm install

# 소스 코드 복사
COPY . .

# 환경변수 (프로덕션)
ENV VITE_API_URL=https://jomha.site
ENV VITE_WS_URL=https://jomha.site

# 빌드 (dist 폴더 생성)
RUN npm run build

# Stage 2: Nginx로 서빙
FROM nginx:alpine

# 빌드된 파일을 nginx html 폴더로 복사
COPY --from=builder /app/dist /usr/share/nginx/html

# 포트 노출
EXPOSE 80 443

CMD ["nginx", "-g", "daemon off;"]
