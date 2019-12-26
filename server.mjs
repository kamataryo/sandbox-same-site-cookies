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
  user1: { password: "user1" },
  user2: { password: "user2" }
};

const format = (text, vars) => {
  let result = text;
  Object.keys(vars).forEach(key => {
    const tag = `%${key}`;
    result = result.replace(tag, vars[key]);
  });
  return result;
};

const chars = "abcdef0123456789";

const genSession = (username, n = 16) => {
  if (userTable[username]) {
    const sessionId = Array.from(crypto.randomFillSync(new Uint8Array(n)))
      .map(n => chars[n % chars.length])
      .join("");
    userTable[username].sessionId = sessionId;
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

const main = async () => {
  const htmls = await getHTMLs([
    "home",
    "home-user",
    "login",
    "login-success",
    "login-failed",
    "404",
    "405"
  ]);

  http
    .createServer((req, res) => {
      res.setHeader("Content-Type", "text/html");

      const { url, method } = req;

      if (url === "/") {
        if (method === "GET") {
          const { "Session-Id": sessionId, Username: username } = parseCookie(
            req.headers.cookie
          );
          if (
            sessionId &&
            userTable[username] &&
            userTable[username].sessionId === sessionId
          ) {
            res.write(format(htmls["home-user"], { username }));
            res.end();
          } else {
            res.write(htmls.home);
            res.end();
          }
        } else {
          res.statusCode = 405;
          res.write(htmls[405]);
          res.end();
        }
      } else if (url === "/login") {
        if (method === "GET") {
          res.write(htmls.login);
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

              if (
                userTable[username] &&
                userTable[username].password === password
              ) {
                const sessionId = genSession(username);
                const cookies = [
                  `Session-Id=${sessionId}; Max-Age=86400; Path=/`,
                  `Username=${username}; Max-Age=86400; Path=/`
                ];

                res.setHeader("Set-Cookie", cookies);
                console.log(res.getHeaders());

                res.write(htmls["login-success"]);
                res.end();
              } else {
                res.write(htmls["login-success"]);
                res.end();
              }
            });
        } else {
          res.statusCode = 405;
          res.write(htmls[405]);
          res.end();
        }
      } else if (url === "/logout") {
        if (method === "GET") {
          const { Username: username } = parseCookie(req.headers.cookie);
          delete userTable[username].sessionId;
          const cookies = [
            `Session-Id=; Max-Age=0; Path=/`,
            `Username=; Max-Age=0; Path=/`
          ];
          res.setHeader("Set-Cookie", cookies);
          res.write("successfully logged out!");
          res.end();
        } else {
          res.statusCode = 405;
          res.write(htmls[405]);
          res.end();
        }
      } else {
        res.statusCode = 404;
        res.write(htmls[404]);
        res.end();
      }
    })
    .listen(3000, () => console.log("Listening..."));
};

main();
