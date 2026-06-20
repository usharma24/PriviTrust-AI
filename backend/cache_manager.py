from cachetools import TTLCache

# OTP Cache: key is user_id, value is string OTP.
# Expires in 120 seconds (2 minutes)
otp_cache = TTLCache(maxsize=1000, ttl=120)

# Failed Logins Cache: key is email, value is count of failed attempts.
# Expires in 900 seconds (15 minutes)
failed_login_cache = TTLCache(maxsize=1000, ttl=900)

# Temporary Risk Cache: key is session_id, value is dict of risk factors/scores.
# Expires in 300 seconds (5 minutes)
temp_risk_cache = TTLCache(maxsize=1000, ttl=300)

def set_otp(user_id: int, otp_code: str):
    """Stores generated OTP in cache."""
    otp_cache[user_id] = otp_code

def verify_otp(user_id: int, otp_code: str) -> bool:
    """Verifies and removes OTP from cache if correct."""
    cached = otp_cache.get(user_id)
    if cached and cached == otp_code:
        del otp_cache[user_id]
        return True
    return False

def increment_failed_logins(email: str) -> int:
    """Increments failed login count for an email address."""
    count = failed_login_cache.get(email, 0) + 1
    failed_login_cache[email] = count
    return count

def clear_failed_logins(email: str):
    """Resets failed login count on successful authentication."""
    if email in failed_login_cache:
        del failed_login_cache[email]

def get_failed_logins(email: str) -> int:
    """Returns number of recent failed login attempts."""
    return failed_login_cache.get(email, 0)
