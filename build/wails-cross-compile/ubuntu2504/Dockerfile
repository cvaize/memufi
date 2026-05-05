FROM registry.fedoraproject.org/fedora-minimal:42

RUN set -xe;\
  echo "fastestmirror=true" >> /etc/dnf/dnf.conf;\
  echo "max_parallel_downloads=20" >> /etc/dnf/dnf.conf;\
  echo "deltarpm=1" >> /etc/dnf/dnf.conf;\
  echo "ip_resolve=4" >> /etc/dnf/dnf.conf;\
  dnf install -y golang nodejs mingw64-gcc mingw32-nsiswrapper.noarch mingw-nsis-base.x86_64 upx gtk3-devel webkit2gtk4.1-devel;

RUN set -xe;\
  useradd -m -u 1000 -g 0 -G 0 -s /bin/bash user; \
  usermod -aG wheel user; \
  echo '%wheel ALL=(ALL) NOPASSWD: ALL' >> /etc/sudoers;

USER user
ENV PATH=/home/user/go/bin:$PATH
RUN go install github.com/wailsapp/wails/v2/cmd/wails@latest && go clean -cache -modcache

USER root
COPY --chmod=755 ./build/wails-cross-compile/entrypoint.sh /entrypoint.sh

USER user
VOLUME /app
WORKDIR /app
ENTRYPOINT ["/entrypoint.sh"]