function validateUsername(value, maxLength, minLength, allowedChars, allowedCharsMiddle) {
    if (!maxLength)
        maxLength = Number.MAX_SAFE_INTEGER
    if (!minLength)
        minLength = 0
    if (typeof value !== 'string')
        return "The username should be a string!"
    if (value.length > maxLength)
        return "Username too long!"
    if (value.length < minLength)
        return "Username too short!"
    if (allowedChars)
        for (let i = 0; i < value.length; i++)
            if (allowedChars.indexOf(value[i]) === -1)
                if (i === 0 || i === value.length-1 && allowedCharsMiddle && allowedCharsMiddle.indexOf(value[i]) !== -1)
                    return ". and - characters are allowed only between the name, not at the beginning nor at the end."
                else if(allowedCharsMiddle && allowedCharsMiddle.indexOf(value[i]) === -1)
                    return "That username includes forbidden character(s)! For example \""+value[i]+'"';
    return true
}

export default validateUsername;