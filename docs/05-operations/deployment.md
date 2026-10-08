# 서버 배포와 롤백

현재 공개 주소: **https://pedal.34-59-139-83.sslip.io**

GitHub repository: https://github.com/Ho-01/pedalboard-simulator
서버 checkout: /home/ho/pedalboard-simulator
서비스 root: /var/www/pedalboard-simulator
사이트 Nginx 설정: /etc/nginx/sites-available/pedalboard-simulator

## commit 기반 배포

```bash
git fetch origin
git checkout main
git pull --ff-only
bash scripts/deploy.sh <full-40-character-commit-sha>
```

deploy.sh는 깨끗한 checkout인지 검사하고, 지정 commit의 별도 worktree에서 npm ci와 production build를 수행한다. 다른 브랜치의 미커밋 파일을 빌드에 섞지 않는다. dist/version.json의 commit/dirty를 검증한 뒤 release directory와 shared asset directory를 채우고 current symlink를 atomic 교체한다.

서버 /tmp는 작은 tmpfs이므로 worktree와 npm/compiler 임시 파일은 디스크의 ~/.cache/pedal-deploy에 만든다. PEDAL_BUILD_ROOT로 변경할 수 있다. build 중 current 서비스는 기존 release를 계속 제공한다.

```text
/var/www/pedalboard-simulator/
  releases/<commit-sha>/
  shared/assets/<vite-content-hash-files>
  shared/engine/<engine-artifact-hash>/
  current -> releases/<commit-sha>/
  acme/
```

이 앱은 static 배포다. runtime Node 서버, DB, native solver 상주 프로세스가 없다. 소리 계산은 브라우저 Worker에서 수행한다.

## 확인

```bash
curl -fsS https://pedal.34-59-139-83.sslip.io/version.json
curl -I https://pedal.34-59-139-83.sslip.io/
sudo nginx -t
```

HTML은 no-cache, version.json은 no-store, hash assets/engine은 immutable cache다. 이전 hash 파일을 shared 디렉토리에 유지해 열린 이전 탭의 worker/engine import를 보호한다. 삭제 정책은 별도 운영 plan 없이 자동 적용하지 않는다.

## 롤백

```bash
bash scripts/rollback.sh <previous-full-commit-sha>
```

기존 release의 HTML/version/commit을 검사한 뒤 current만 atomic 변경한다. npm install/build는 다시 하지 않는다. 이전 release가 없는 SHA로는 롤백할 수 없다.

## HTTPS

이 서브도메인만 별도 Nginx server_name을 사용한다. 80 포트는 ACME challenge를 제외하고 HTTPS로 이동한다. certbot webroot는 /var/www/pedalboard-simulator/acme이며 certbot.timer가 인증서를 자동 갱신한다. deploy/nginx/pedalboard-simulator.conf가 저장소의 원본 설정이다.

기존 블로그/게임/포트폴리오/familiar/cokac 설정과 서비스 디렉토리는 건드리지 않는다. 사이트 설정 변경 후 nginx -t와 기존 호스트 응답을 검사한다.

## Git 운영

plan 승인 후 feat/*에서 개발하고 검증/report를 남긴다. 최종 review 자료는 Git diff, BOM/node map, 모델 상태, numerical evidence, 대응 report다. 사용자가 승인한 이번 첫 구현은 검증 뒤 main으로 fast-forward한다. 일반 기능 개발은 AGENTS.md와 docs/00-guide/development-workflow.md를 따른다.
