# Security policy

## Reporting a vulnerability

Please do not open a public issue for a security problem. Use GitHub's private
reporting instead: open the **Security** tab of this repository and choose
**Report a vulnerability**. Include what you found, how to reproduce it, and what
it affects.

You will get a reply as soon as I can, and I will credit you in the fix if you
would like that.

## What is in scope

This is a student project, but it holds real people's contact details and
identity documents, so these matter most:

- Access to another user's private data (email, phone, student ID, documents)
- Becoming an administrator, or acting as another user
- Reading or writing the database or storage outside the app's own rules

## How private data is protected

- Email, phone and student ID are not readable through the public API; they are
  returned only through database functions that check the relationship between
  the two people.
- Identity documents live in a private storage bucket and are opened through
  short-lived signed links, only by administrators.
- Administrator access cannot be gained through sign-up or by editing a profile.
