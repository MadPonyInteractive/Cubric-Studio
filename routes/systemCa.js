'use strict';

/**
 * systemCa.js — make this Node process trust the OS certificate store (MPI-935).
 *
 * Node trusts only its bundled Mozilla CA list. Antivirus HTTPS scanning (Kaspersky,
 * ESET, Avast, Bitdefender) re-signs every TLS connection with a root it installs into
 * the Windows store, so the browser works and every Node download fails with
 * SELF_SIGNED_CERT_IN_CHAIN. Adding the system store fixes every outbound call in the
 * process at once — call this before the first request, in each process that makes one
 * (main.js and the forked server.js).
 *
 * `default` (not `bundled`) keeps NODE_EXTRA_CA_CERTS. A shell with
 * NODE_USE_SYSTEM_CA=1 already trusts the store, which hides this bug when testing.
 */
const tls = require('tls');

function trustSystemCa() {
  // Duplicates are fine: the store keeps one of each (the Windows store itself lists
  // 123 entries for 67 certs).
  tls.setDefaultCACertificates([
    ...tls.getCACertificates('default'),
    ...tls.getCACertificates('system'),
  ]);
}

module.exports = { trustSystemCa };
