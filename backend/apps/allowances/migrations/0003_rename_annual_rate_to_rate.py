from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('allowances', '0002_initial'),
    ]

    operations = [
        migrations.RenameField(
            model_name='interestrule',
            old_name='annual_rate',
            new_name='rate',
        ),
        migrations.AlterField(
            model_name='interestrule',
            name='rate',
            field=models.DecimalField(
                max_digits=6,
                decimal_places=4,
                help_text="Rate applied at each accrual (relative to `schedule`, not annualized), e.g. 0.0200 = 2% of the balance every period.",
            ),
        ),
    ]
