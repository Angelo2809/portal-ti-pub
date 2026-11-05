export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_HINT = 'Use pelo menos 8 caracteres, com maiúscula, minúscula, número e caractere especial.';
export const PASSWORD_PATTERN = String.raw`(?=.*\p{Lu})(?=.*\p{Ll})(?=.*[0-9])(?=.*[\p{P}\p{S}]).{8,}`;

const passwordRegex = new RegExp(`^(?:${PASSWORD_PATTERN})$`, 'u');
export const isStrongPassword = password => typeof password === 'string' && passwordRegex.test(password);
