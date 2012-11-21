var {StringBuffer, Integer} = java.lang;

exports.bytesToHex = function(bytes) {
    var buf = new StringBuffer(bytes.length * 2);
    for (let idx = 0; idx < bytes.length; idx += 1) {
        buf.append(Integer.toString((bytes[idx] & 0xff) + 0x100, 16).substring(1));
    }
    return buf.toString();
};
