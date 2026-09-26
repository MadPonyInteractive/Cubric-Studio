# MPI-929 Checklist

- [x] root cause: generation:error after a Stop tore down the held cancelled placeholder
- [x] gallery: generation:error leaves a placeholder whose cancelled clip is playing
- [x] spec: cloud Stop before the POST plays the cancelled clip
- [x] live: not hittable by hand (the pre-send window is milliseconds; after send there is by design no walk-off, MPI-928) - held by mascot spec case 4
