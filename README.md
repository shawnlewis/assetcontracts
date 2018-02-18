# CHRP Coin

## Running tests

Tests don't work in ganace-cli 6.1.0 because it's not consistent about how many blocks are mined, and
we need fine-grained control of that. So for tests use the version in truffle.

```bash
truffle develop
test
```
