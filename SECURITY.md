# Security / Segurança

For a suspected vulnerability, avoid posting credentials, personal data or exploit details in a public issue. Use the repository's private vulnerability reporting feature if the maintainer has enabled it; otherwise request a private contact without disclosing details. No dedicated security email or guaranteed response window is defined here.

The demo intentionally publishes fixed credentials and must remain a local demonstration. Real deployments must use `DEMO_MODE=false`, separate databases and individual accounts. Complete first-administrator setup before exposing the application, serve through HTTPS with `COOKIE_SECURE=true`, and protect database access and backups.

Authorization is enforced in the API. Requesters are limited to their own tickets; operators see the support queue; administrators manage users and configuration. Attachments require ticket access. User-supplied rich text is sanitized. Passwords use salted scrypt and stored session tokens are hashed. These controls do not replace deployment review, monitoring or infrastructure protection.

Current limitations include no MFA/SSO, no email recovery, no attachment malware scanning and an in-memory login limiter. See the README and integration guide before extending authentication or deploying multiple instances.

Em caso de vulnerabilidade, não exponha dados ou credenciais em issues públicas. Use o relato privado do repositório, se habilitado, ou peça um contato privado sem revelar detalhes. A demo tem senhas públicas: para uso real, desative-a, crie usuários próprios, conclua a configuração inicial antes da exposição e use HTTPS com cookies seguros.
