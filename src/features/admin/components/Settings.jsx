import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import Card from '../../../components/ui/Card';
import Alert from '../../../components/ui/Alert';
import ErrorBoundary from '../../../components/ErrorBoundary';

export default function AdminSettings() {
  const { t } = useTranslation();
  const [settings, setSettings] = useState({
    siteName: 'Qotoof',
    adminEmail: 'admin@qotoof.com',
    maxUploadSize: 10,
    maintenanceMode: false,
    taxRate: 10,
  });
  const [message, setMessage] = useState('');

  const { mutate: saveSettings, isPending } = useMutation({
    mutationFn: async (data) => {
      const response = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error(t('common.error'));
      return response.json();
    },
    onSuccess: () => {
      setMessage(t('admin.settingsSaved'));
      setTimeout(() => setMessage(''), 3000);
    },
  });

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
        <div className="max-w-4xl mx-auto px-4">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">{t('admin.settings')}</h1>
          {message && <Alert type="success" message={message} />}

          {/* General Settings */}
          <Card title="General Settings" className="mb-6">
            <div className="space-y-4">
              <Input
                label="Site Name"
                value={settings.siteName}
                onChange={(e) => setSettings({ ...settings, siteName: e.target.value })}
              />
              <Input
                label="Admin Email"
                type="email"
                value={settings.adminEmail}
                onChange={(e) => setSettings({ ...settings, adminEmail: e.target.value })}
              />
              <Input
                label="Max Upload Size (MB)"
                type="number"
                value={settings.maxUploadSize}
                onChange={(e) => setSettings({ ...settings, maxUploadSize: parseInt(e.target.value, 10) })}
              />
            </div>
          </Card>

          {/* Business Settings */}
          <Card title="Business Settings" className="mb-6">
            <div className="space-y-4">
              <Input
                label="Tax Rate (%)"
                type="number"
                value={settings.taxRate}
                onChange={(e) => setSettings({ ...settings, taxRate: parseFloat(e.target.value) })}
              />
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={settings.maintenanceMode}
                  onChange={(e) => setSettings({ ...settings, maintenanceMode: e.target.checked })}
                  className="w-4 h-4 rounded"
                />
                <span className="ml-2 text-gray-700 dark:text-gray-300">Maintenance Mode</span>
              </label>
            </div>
          </Card>

          {/* Action Buttons */}
          <div className="flex gap-4">
            <Button onClick={() => saveSettings(settings)} variant="primary" loading={isPending}>
              {t('common.save')}
            </Button>
            <Button variant="secondary">{t('common.cancel')}</Button>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}

AdminSettings.propTypes = {};
