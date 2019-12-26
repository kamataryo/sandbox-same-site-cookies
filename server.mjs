#!/usr/bin/env node

import http from "http";
import fs from "fs";
import { promisify } from "util";
import { dirname } from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));

const readFile = promisify(fs.readFile);
const getHTMLs = pages =>
  Promise.all(
    pages.map(page => readFile(`${__dirname}/htmls/${page}.html`))
  ).then(htmls =>
    htmls.reduce((prev, html, index) => {
      prev[pages[index]] = html.toString("utf-8");
      return prev;
    }, {})
  );

const userTable = {
  admin: { password: "admin" },
  user1: { password: "user1" },
  user2: { password: "user2" }
};

const format = (text, vars) => {
  let result = text;
  Object.keys(vars).forEach(key => {
    const regexp = new RegExp(`%${key}`, "g");
    result = result.replace(regexp, vars[key]);
  });
  return result;
};

const chars = "abcdef0123456789";

const websites = {
  "strict.test": {
    sameSite: "Strict",
    siteName: "website A"
  },
  "lax.test": {
    sameSite: "Lax",
    siteName: "website B"
  },
  "none.test": {
    sameSite: "None",
    siteName: "website C"
  }
};

const createLoginHeader = (username, host) => `
<header style="background:gray;color:white;margin:none">
  <span>Hello, <em>${username}!</em>Your site is ${host}</span>
</header>`;

const footerLinkList = `
    <hr />
    <footer>
      <h2>Switch Site</h2>
      <ul>${Object.keys(websites)
        .map(domain => {
          const { siteName, sameSite } = websites[domain];
          const label = `${siteName} <code>SameSite=${sameSite}</code>`;
          return `
         <li>
          ${label}
          <ul>
                  <li>
          <a href="http://${domain}">
            GET</code>
          </a>
        </li>
        <li>
          <form action="http://${domain}" method="POST">
            <button>POST</button>
          </form>
        </li>
          </ul>
         </li>
`;
        })
        .join("")}
        </ul>
    </footer>
`;

const genSession = (username, host, n = 16) => {
  if (userTable[username]) {
    const sessionId = Array.from(crypto.randomFillSync(new Uint8Array(n)))
      .map(n => chars[n % chars.length])
      .join("");
    userTable[username].sessionId = sessionId;
    userTable[username].host = host;
    return sessionId;
  } else {
    return null;
  }
};

const parseCookie = cookie => {
  return Object.fromEntries(
    (cookie || "").split(";").map(kvp => kvp.trim().split("="))
  );
};

const startServer = async () => {
  const htmls = await getHTMLs([
    "home",
    "home-user",
    "login",
    "login-success",
    "login-failed",
    "logout",
    "400",
    "404",
    "405"
  ]);

  http
    .createServer((req, res) => {
      const host = req.headers.host;

      res.setHeader("Content-Type", "text/html");

      const {
        url,
        method,
        headers: { cookie }
      } = req;

      const { "Session-Id": sessionId, Username: username } = parseCookie(
        cookie
      );

      const isLoggedIn =
        sessionId &&
        userTable[username] &&
        userTable[username].sessionId === sessionId;

      const site = {
        username,
        ...websites[host],
        host,
        footerLinkList,
        loginHeader: isLoggedIn
          ? createLoginHeader(username, host)
          : "<p>You can login with <code>admin:admin</code></p>"
      };

      if (url === "/") {
        if (method === "GET" || method === "POST") {
          if (isLoggedIn) {
            res.write(format(htmls["home-user"], site));
            res.end();
          } else {
            res.write(format(htmls.home, site));
            res.end();
          }
        } else {
          res.statusCode = 405;
          res.write(format(htmls[405], site));
          res.end();
        }
      } else if (url === "/login") {
        if (method === "GET") {
          res.write(format(htmls.login, site));
          res.end();
        } else if (method === "POST") {
          let body = [];
          req
            .on("data", chunk => {
              body.push(chunk);
            })
            .on("end", () => {
              const { username, password } = Object.fromEntries(
                Buffer.concat(body)
                  .toString()
                  .split("&")
                  .map(kvp => kvp.split("="))
              );

              // Authentication
              if (
                userTable[username] &&
                userTable[username].password === password
              ) {
                const sessionId = genSession(username, req.headers.host);
                const cookies = [
                  `Session-Id=${sessionId}; Max-Age=86400; Path=/; SameSite=${site.sameSite}`,
                  `Username=${username}; Max-Age=86400; Path=/; SameSite=${site.sameSite}`
                ];
                res.setHeader("Set-Cookie", cookies);
                res.write(format(htmls["login-success"], site));
                res.end();
              } else {
                res.write(format(htmls["login-success"], site));
                res.end();
              }
            });
        } else {
          res.statusCode = 405;
          res.write(format(htmls[405], site));
          res.end();
        }
      } else if (url === "/logout") {
        if (method === "GET") {
          if (isLoggedIn && userTable[username]) {
            delete userTable[username].sessionId;
            delete userTable[username].host;
            const cookies = [
              `Session-Id=; Max-Age=0; Path=/`,
              `Username=; Max-Age=0; Path=/`
            ];
            res.setHeader("Set-Cookie", cookies);
            res.write(format(htmls.logout, site));
            res.end();
          } else {
            res.write(format(htmls[400], site));
            res.end();
          }
        } else {
          res.statusCode = 405;
          res.write(format(htmls[405], site));
          res.end();
        }
      } else {
        res.statusCode = 404;
        res.write(format(htmls[404], site));
        res.end();
      }
    })
    .listen(80, () =>
      Object.keys(websites).forEach(domain =>
        console.log(`http://${domain} is listening...`)
      )
    );
};

startServer();
