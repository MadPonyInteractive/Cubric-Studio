# MPI-1312 checklist

- [ ] Numbered tags on every multi-picture edit/control slot (edit, kleinEdit, krea2Edit, qwenEdit, control)
- [ ] Each model writes the wording its encoder reads (`image 2`, Qwen-Image 2.1 `<image2>`)
- [ ] A test that every model op with 2+ reference slots arms the `@` picker
- [ ] Add-model playbook names the check
- [ ] Lint + tests green; seen in an isolated app
