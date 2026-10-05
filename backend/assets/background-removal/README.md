# MODNet portrait matting

`modnet.onnx` is the unmodified FP32 ONNX export from
[Xenova/modnet](https://huggingface.co/Xenova/modnet), revision
`fa2fa546052fba4c08921230a26cc69a333fca12`, file `onnx/model.onnx`.

- Original project: [ZHKKKe/MODNet](https://github.com/ZHKKKe/MODNet).
- Authors: Zhanghan Ke, Kaican Li, Yurou Zhou, Qiong Yan and Rynson W. H. Lau.
- License: Apache 2.0; the upstream license is included in `LICENSE-MODNET.txt`.
- Size: 25,888,640 bytes.
- SHA-256: `07c308cf0fc7e6e8b2065a12ed7fc07e1de8febb7dc7839d7b7f15dd66584df9`.

The application uses ONNX Runtime's CPU provider in a short-lived worker,
one request at a time. No model download, API key, GPU or third-party image
service is needed at runtime. Deployment sets `ONNXRUNTIME_NODE_INSTALL=skip`
to use the CPU binaries bundled in the npm package without downloading CUDA.

Input is RGB, 512 by 512, normalized to [-1, 1]. The predicted alpha matte is
resized to the oriented original (maximum 1800 pixels on its longest side),
multiplied by its existing alpha and saved as PNG. This model is intended for
photos of people; the editor previews the result before applying it and retains
the original URL for restoration. Difficult hair, veils or backgrounds can still
need another photo.
