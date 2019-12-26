#!/bin/sh

set -eu

function cleanup {
  echo 'cleaning up...'
  TEMP=$(mktemp)
  sed '/# @kamataryo\/sandbox-same-site-cookies/d' /etc/hosts > $TEMP
  cat $TEMP > /etc/hosts
  rm $TEMP
}

trap cleanup EXIT

echo 'managing hosts...'
echo '127.0.0.1 strict.test # @kamataryo/sandbox-same-site-cookies' >> /etc/hosts
echo '127.0.0.1    lax.test # @kamataryo/sandbox-same-site-cookies' >> /etc/hosts
echo '127.0.0.1   none.test # @kamataryo/sandbox-same-site-cookies' >> /etc/hosts

node server.mjs

