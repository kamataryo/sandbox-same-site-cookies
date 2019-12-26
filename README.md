# @kamataryo/sandbox-same-site-cookies

This is an instant server to try `SameSite=Strict|Lax|None` cookies.

## usage

You can try with:

```shell
$ sudo npx @kamataryo/sandbox-same-site-cookies
```

Then open [http://strict.test](http://strict.test).

![screenshot](screenshot.png)

## Q&A

- Q: Why is `sudo` required?
- A: This command edit the `/etc/hosts` to use multiple local domains.

- Q: How can I try `SameSite`?
- A:
  1. login at http://strict.test/login first
  2. Move to http://stirict.test with `GET` and you will see a login header
  3. Move to http://none.test with `GET`
  4. Move to http://strict.test with `GET` again and you will miss the login header, i.e. the cookie is not used
  5. login at http://lax.test/login next
  6. Move to http://lax.test with `GET` and you will see the login header
  7. Move to http://none.test with `GET`
  8. Move to http://lax.test with `GET` again and you will see the login header again, i.e. the cookie is used
  9. However, if you use `POST` to move, you will miss the login header, i.e. the cookie is not used
