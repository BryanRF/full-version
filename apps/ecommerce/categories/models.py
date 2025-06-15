from django.db import models

class Category(models.Model):
    name = models.CharField(max_length=255)
    image = models.ImageField(upload_to='categories/', blank=True, null=True)
    detail = models.TextField()
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return self.name
