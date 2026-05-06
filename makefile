build_deb:
	mkdir -p ./build/debian/tmp/memufi/DEBIAN
	mkdir -p ./build/debian/tmp/memufi/usr/bin
	mkdir -p ./build/debian/tmp/memufi/usr/share/applications
	mkdir -p ./build/debian/tmp/memufi/usr/share/icons/MeMuFi
	cp ./build/bin/memufi-ubuntu-amd64.run ./build/debian/tmp/memufi/usr/bin/memufi
	cp ./build/debian/control ./build/debian/tmp/memufi/DEBIAN/control
	cp ./build/debian/menu.desktop ./build/debian/tmp/memufi/usr/share/applications/MeMuFi.desktop
	cp ./build/appicon.svg ./build/debian/tmp/memufi/usr/share/icons/MeMuFi/MeMuFi.svg
	chmod 755 ./build/debian/tmp/memufi/usr/bin/memufi
	dpkg-deb  --root-owner-group --build ./build/debian/tmp/memufi ./build/bin/memufi-ubuntu-amd64.deb