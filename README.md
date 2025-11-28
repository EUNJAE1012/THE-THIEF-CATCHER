## 🔐 HTTPS 개발 서버용 인증서 생성 가이드

이 프로젝트는 WebRTC·보안 기능을 위해 HTTPS 환경을 필요로 합니다.
개발 환경에서는 Self-signed 인증서를 직접 생성하여 사용합니다.

> ⚠️ 주의  
> server.key, server.crt, server.csr 파일은 절대 Git에 커밋하지 마세요.  
> 개발 환경용 인증서이며 외부에 노출되면 안 됩니다.

---

### 1) 인증서 저장 폴더 생성

mkdir -p server/cert
cd server/cert

### 2) Private Key 생성 (server.key)

openssl genrsa -out server.key 2048

### 3) CSR 생성 (server.csr)

openssl req -new -key server.key -out server.csr

Common Name(CN) 입력 시:
- 로컬 개발용 → localhost
- 나머지 항목은 Enter로 넘어가도 됩니다.

### 4) Self-signed 인증서 생성 (server.crt)

openssl x509 -req -days 365 -in server.csr -signkey server.key -out server.crt

### 5) 생성된 파일 구조

server/
  cert/
    server.key   # 개인키 (절대 공개 금지)
    server.csr   # 인증서 서명 요청 파일
    server.crt   # 자체 서명 인증서



### 초기 세팅
root 에서 

npm install
cd ./client
npm install


<br>

### 실행 방법
root 에서

cd ./client
npm run build
cd ../server
npm run server
cd ..