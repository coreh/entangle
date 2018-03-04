// #region 💫 account:imports
import tfa from 'tfa';
import assert from 'assert';
// #endregion 💫

import { UserAccount } from './account';

class UserAccount_TwoFactor extends UserAccount {

    constructor(data) {
        super(data);

        // #region 🔨 account:constructor
        this.twoFactorSecret = data.twoFactorSecret;
        // #endregion 🔨
    }

    // #region 🔨 account:methods
    verifyTwoFactor(code) {
        return tfa.verify(this.twoFactorSecret, code);
    }
    // #endregion 🔨
}
