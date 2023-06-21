function validateUsername(value, maxLength, minLength, allowedChars, allowedCharsMiddle) {
    if (!maxLength)
        maxLength = Number.MAX_SAFE_INTEGER
    if (!minLength)
        minLength = 0
    if (typeof value !== 'string')
        return "<span style='color: red;'>The username should be a string!</span>"
    if (value.length > maxLength)
        return "<span style='color: red;'>Username too long!</span>"
    if (value.length < minLength)
        return "<span style='color: red;'>Username too short!</span>"
    if (allowedChars)
        for (let i = 0; i < value.length; i++)
            if (allowedChars.indexOf(value[i]) === -1)
                if (i === 0 || i === value.length-1 && allowedCharsMiddle && allowedCharsMiddle.indexOf(value[i]) !== -1)
                    return "<span style='color: red;'>. and - characters are allowed only between the name, not at the beginning nor at the end.</span>"
                else if(allowedCharsMiddle && allowedCharsMiddle.indexOf(value[i]) === -1)
                    return "<span style='color: red;'>That username includes forbidden character(s)! For example \""+value[i]+'"</span>';
    return true
}

export default validateUsername;