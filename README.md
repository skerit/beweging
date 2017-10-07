# Beweging

This is a node.js module

## Requirements

You'll need to install the `face_recognition` python module and some others.

On Ubuntu 16.04 you'll need to do this:

```bash
sudo apt install cmake python3 python3-pip python3-scipy
sudo pip3 install opencv-python
```

### OpenCV on the Raspberry Pi

There is no opencv package for the raspberry pi, so we need to make it ourselves.

You can follow this guide:

https://www.pyimagesearch.com/2016/04/18/install-guide-raspberry-pi-3-raspbian-jessie-opencv-3/

cmake -D CMAKE_BUILD_TYPE=RELEASE \
    -D CMAKE_INSTALL_PREFIX=/usr/local \
    -D INSTALL_PYTHON_EXAMPLES=ON \
    -D OPENCV_EXTRA_MODULES_PATH=~/projects/opencv_contrib-3.3.0/modules \
    -D BUILD_EXAMPLES=OFF ..