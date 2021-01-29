## Notes about dates in MySQL

The DATETIME/TIMESTAMP format is `YYYY-MM-DD HH:mm:ss`. The format does not allow you to include a timezone. You can specify parts of seconds, by appending `.123456`, but by default, timestamps are only accurate to the second, and are automatically truncated on insert. You can use `DATETIME(6)` to specify up to 6 decimal places in the seconds.

In theory, `DATETIME` accepts and stores the timestamp exactly as supplied, while `TIMESTAMP` converts it from local to UTC before storing, and then back to local before returning it to the user. The timezone here is the MySQL server timezone though, not the timezone of the client doing the querying.

The DATE format is `YYYY-MM-DD`. If you include a time, MySQL silently ignores it.

See [Date and Time Data Types](https://dev.mysql.com/doc/refman/8.0/en/date-and-time-types.html) and [Fractional Seconds in Time Values](https://dev.mysql.com/doc/refman/8.0/en/fractional-seconds.html) for more details.

## Notes about how dates are handled by mysql2

### Encoding for insert/update

JavaScript Date objects are encoded as strings using the [sqlstring npm package](https://github.com/mysqljs/sqlstring). This is true regardless of the `dateStrings` option. Although it attempts to handle time zones, only `'local'` and `'Z'` (i.e. UTC) will work correctly.

```js
SqlString.dateToString = function dateToString(date, timeZone) {
  var dt = new Date(date);

  if (isNaN(dt.getTime())) {
    return 'NULL';
  }

  var year;
  var month;
  var day;
  var hour;
  var minute;
  var second;
  var millisecond;

  if (timeZone === 'local') {
    year = dt.getFullYear();
    month = dt.getMonth() + 1;
    day = dt.getDate();
    hour = dt.getHours();
    minute = dt.getMinutes();
    second = dt.getSeconds();
    millisecond = dt.getMilliseconds();
  } else {
    var tz = convertTimezone(timeZone);

    if (tz !== false && tz !== 0) {
      dt.setTime(dt.getTime() + tz * 60000);
    }

    year = dt.getUTCFullYear();
    month = dt.getUTCMonth() + 1;
    day = dt.getUTCDate();
    hour = dt.getUTCHours();
    minute = dt.getUTCMinutes();
    second = dt.getUTCSeconds();
    millisecond = dt.getUTCMilliseconds();
  }

  // YYYY-MM-DD HH:mm:ss.mmm
  var str =
    zeroPad(year, 4) +
    '-' +
    zeroPad(month, 2) +
    '-' +
    zeroPad(day, 2) +
    ' ' +
    zeroPad(hour, 2) +
    ':' +
    zeroPad(minute, 2) +
    ':' +
    zeroPad(second, 2) +
    '.' +
    zeroPad(millisecond, 3);

  return escapeString(str);
};

function convertTimezone(tz) {
  if (tz === 'Z') {
    return 0;
  }

  var m = tz.match(/([\+\-\s])(\d\d):?(\d\d)?/);
  if (m) {
    return (
      (m[1] === '-' ? -1 : 1) *
      (parseInt(m[2], 10) + (m[3] ? parseInt(m[3], 10) : 0) / 60) *
      60
    );
  }
  return false;
}
```

Source: https://github.com/mysqljs/sqlstring/blob/b580866cdedfd748e110a87fbfb27b5154b99545/lib/SqlString.js#L119-L164

If the MySQL field you are writing to is of type `DATE`, the time portion is simply ignored by MySQL.

### Parsing `DATE` values

If you have `dateStrings` enabled, the string is returned in the form `YYYY-MM-DD`.

If you do not have `dateStrings` enabled, they are passed using:

```js
function parseDate(timezone) {
  const strLen = this.readLengthCodedNumber();
  if (strLen === null) {
    return null;
  }
  if (strLen !== 10) {
    // we expect only YYYY-MM-DD here.
    // if for some reason it's not the case return invalid date
    return new Date(NaN);
  }
  const y = this.parseInt(4);
  this.offset++; // -
  const m = this.parseInt(2);
  this.offset++; // -
  const d = this.parseInt(2);
  if (!timezone || timezone === 'local') {
    return new Date(y, m - 1, d);
  }
  if (timezone === 'Z') {
    return new Date(Date.UTC(y, m - 1, d));
  }
  return new Date(
    `${leftPad(4, y)}-${leftPad(2, m)}-${leftPad(2, d)}T00:00:00${timezone}`,
  );
}
```

Source: https://github.com/sidorares/node-mysql2/blob/a640d471f043eb078c09ab0d6016030c315bd879/lib/packets/packet.js#L595-L619

This will result in a JavaScript Date that is midnight on the requested day, in the `timezone`.

### Parsing `DATETIME` and `TIMESTAMP` values

If you have `dateStrings` enabled, the string is returned in the form `YYYY-MM-DD HH:mm:ss` (or `YYYY-MM-DD HH:mm:ss.mmm` or whatever number of decimal places you specified in MySQL).

If you do not have `dateStrings` enabled, both `DATETIME` and `TIMESTAMP` are simply passed to `new Date` with an optional timezone suffix.

```js
function parseDateTime(timezone) {
  const str = this.readLengthCodedString('binary');
  if (str === null) {
    return null;
  }
  if (!timezone || timezone === 'local') {
    return new Date(str);
  }
  return new Date(`${str}${timezone}`);
}
```

Source: https://github.com/sidorares/node-mysql2/blob/a640d471f043eb078c09ab0d6016030c315bd879/lib/packets/packet.js#L621-L630

### The "timezone" option

The default timezone is "local" which respects the time zone of the sytem,
and can be overriden via the `TZ` environment variable. You can use UTC
by setting the timestamp to "Z". There is an attempt at supporting other
time zones (e.g. https://github.com/mysqljs/sqlstring/blob/b580866cdedfd748e110a87fbfb27b5154b99545/lib/SqlString.js#L232-L236)
but it doesn't look like it will be reliable.
