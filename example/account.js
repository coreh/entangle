// #region 💫 account:imports
import tfa from 'tfa';
import assert from 'assert';
// #endregion 💫

export class UserAccount {

    constructor(data) {
        super(data);

        // #region 🚧 account:constructor
        this.balance = 0;
        this.twoFactorSecret = data.twoFactorSecret;
        // #endregion 🚧
    }

    // #region 🚧 account:methods
    credit(amount) {
        this.balance += amount;
    }

    debit(amount) {
        assert(this.balance - amount >= 0, 'Not enough balance');
        this.balance -= amount;
    }

    verifyTwoFactor(code) {
        return tfa.verify(this.twoFactorSecret, code);
    }

    // #endregion 🚧
}
