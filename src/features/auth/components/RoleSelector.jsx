import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../../../components/ui/Button';
import Card from '../../../components/ui/Card';
import ErrorBoundary from '../../../components/ErrorBoundary';

/**
 * RoleSelector Component - User role selection during signup
 * 
 * Features:
 * - 4 role options (Admin, Vendor, Buyer, Driver)
 * - Detailed role descriptions
 * - Role benefits and features
 * - Icon representation
 * - Selection highlight
 * - Proceed button
 * - Multi-language support
 * 
 * @component
 */
function RoleSelectorContent() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [selectedRole, setSelectedRole] = useState(null);

  const roles = [
    {
      id: 'buyer',
      icon: '🛒',
      title: t('auth.roleSelector.buyerTitle'),
      description: t('auth.roleSelector.buyerDesc'),
      features: [
        t('auth.roleSelector.buyerFeature1'),
        t('auth.roleSelector.buyerFeature2'),
        t('auth.roleSelector.buyerFeature3'),
      ],
    },
    {
      id: 'vendor',
      icon: '🏪',
      title: t('auth.roleSelector.vendorTitle'),
      description: t('auth.roleSelector.vendorDesc'),
      features: [
        t('auth.roleSelector.vendorFeature1'),
        t('auth.roleSelector.vendorFeature2'),
        t('auth.roleSelector.vendorFeature3'),
      ],
    },
    {
      id: 'driver',
      icon: '🚚',
      title: t('auth.roleSelector.driverTitle'),
      description: t('auth.roleSelector.driverDesc'),
      features: [
        t('auth.roleSelector.driverFeature1'),
        t('auth.roleSelector.driverFeature2'),
        t('auth.roleSelector.driverFeature3'),
      ],
    },
    {
      id: 'admin',
      icon: '👨‍💼',
      title: t('auth.roleSelector.adminTitle'),
      description: t('auth.roleSelector.adminDesc'),
      features: [
        t('auth.roleSelector.adminFeature1'),
        t('auth.roleSelector.adminFeature2'),
        t('auth.roleSelector.adminFeature3'),
      ],
    },
  ];

  const handleRoleSelect = (roleId) => {
    setSelectedRole(roleId);
  };

  const handleProceed = () => {
    if (selectedRole) {
      navigate('/auth/register', { state: { role: selectedRole } });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-5xl">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            {t('auth.roleSelector.title')}
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            {t('auth.roleSelector.subtitle')}
          </p>
        </div>

        {/* Role Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {roles.map((role) => (
            <Card
              key={role.id}
              className={`cursor-pointer transition-all duration-300 ${
                selectedRole === role.id
                  ? 'ring-2 ring-blue-500 shadow-lg scale-105'
                  : 'hover:shadow-lg hover:scale-102'
              }`}
              onClick={() => handleRoleSelect(role.id)}
              role="button"
              tabIndex="0"
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  handleRoleSelect(role.id);
                }
              }}
            >
              {/* Icon */}
              <div className="text-5xl text-center mb-4">{role.icon}</div>

              {/* Title */}
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2 text-center">
                {role.title}
              </h3>

              {/* Description */}
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 text-center">
                {role.description}
              </p>

              {/* Features List */}
              <ul className="space-y-2 mb-4">
                {role.features.map((feature, idx) => (
                  <li key={idx} className="flex items-start text-sm text-gray-700 dark:text-gray-300">
                    <span className="text-green-500 mr-2 font-bold">✓</span>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              {/* Selection Indicator */}
              {selectedRole === role.id && (
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-center">
                    <span className="inline-flex items-center justify-center w-6 h-6 bg-blue-500 text-white rounded-full">
                      ✓
                    </span>
                    <span className="ml-2 text-sm font-medium text-blue-600 dark:text-blue-400">
                      {t('auth.roleSelector.selected')}
                    </span>
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>

        {/* Bottom Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Why Choose Qotoof */}
            <div>
              <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-3">
                {t('auth.roleSelector.whyChoose')}
              </h4>
              <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                <li>✓ {t('auth.roleSelector.whyPoint1')}</li>
                <li>✓ {t('auth.roleSelector.whyPoint2')}</li>
                <li>✓ {t('auth.roleSelector.whyPoint3')}</li>
              </ul>
            </div>

            {/* Selected Role Info */}
            <div>
              {selectedRole ? (
                <>
                  <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-3">
                    {t('auth.roleSelector.yourRole')}
                  </h4>
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {roles.find(r => r.id === selectedRole)?.title}
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-3">
                    {t('auth.roleSelector.selectRole')}
                  </h4>
                  <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {t('auth.roleSelector.selectRoleMessage')}
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* Next Steps */}
            <div>
              <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-3">
                {t('auth.roleSelector.nextSteps')}
              </h4>
              <ol className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                <li>1. {t('auth.roleSelector.step1')}</li>
                <li>2. {t('auth.roleSelector.step2')}</li>
                <li>3. {t('auth.roleSelector.step3')}</li>
              </ol>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4 justify-center">
          <Button
            variant="outline"
            onClick={() => navigate('/login')}
            className="px-8"
          >
            {t('auth.roleSelector.haveAccount')}
          </Button>
          <Button
            disabled={!selectedRole}
            onClick={handleProceed}
            className="px-8"
          >
            {t('auth.roleSelector.proceedButton')}
          </Button>
        </div>

        {/* Help Section */}
        <div className="text-center mt-8">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {t('auth.roleSelector.help')}{' '}
            <a href="/support" className="text-blue-600 hover:text-blue-800 dark:text-blue-400 font-medium">
              {t('auth.roleSelector.contactUs')}
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function RoleSelector() {
  return (
    <ErrorBoundary>
      <RoleSelectorContent />
    </ErrorBoundary>
  );
}

RoleSelector.propTypes = {};
